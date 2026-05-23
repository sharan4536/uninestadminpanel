/**
 * chatService.ts — High-Performance Real-Time Chat Service
 *
 * Provides:
 * - Optimistic message sending (instant UI, background Firestore write)
 * - Real-time listeners scoped to a single chatId
 * - Paginated message loading (latest 30, load-more on scroll)
 * - Local message cache with deduplication
 * - Typing indicator (lightweight Firestore field)
 * - Read receipts (sent → delivered → seen)
 * - Automatic retry for failed messages
 * - Anti-spam for typing status updates
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  updateDoc,
  orderBy,
  limit,
  limitToLast,
  Timestamp,
  writeBatch,
  startAfter,
  endBefore,
  DocumentSnapshot,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from './client';

// ─── Types ──────────────────────────────────────────────────────────────────

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'seen' | 'failed';

export interface ChatMessage {
  id: string;
  chatId: string;
  text: string;                // Decrypted / plain text for UI display
  encryptedContent?: string;   // Raw content stored in Firestore
  senderId: string;
  receiverId?: string;
  createdAt: Date;
  status: MessageStatus;
  read: boolean;
  /** Client-only: true for messages added optimistically before server ack */
  _optimistic?: boolean;
  /** Client-only: retry count for failed sends */
  _retryCount?: number;
  replyTo?: {
    id: string;
    text: string;
    senderName: string;
  } | null;
}

export interface TypingState {
  [userId: string]: number; // timestamp in ms, 0 = not typing
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 30;
const TYPING_TIMEOUT_MS = 4000;      // Auto-clear typing after 4s
const TYPING_THROTTLE_MS = 2000;     // Don't write typing status more than every 2s
const RETRY_DELAYS = [1000, 3000, 8000]; // Exponential retry delays

// ─── Local Message Cache ────────────────────────────────────────────────────

const messageCache = new Map<string, ChatMessage[]>();
const oldestDocCache = new Map<string, QueryDocumentSnapshot | null>();

// ─── LocalStorage L2 Cache ───────────────────────────────────────────────────
const LS_PREFIX = 'uninest_msgs_';
const LS_MAX_MSGS = 50;

/** Persist the latest N messages to localStorage for instant load on next open */
function persistToLS(chatId: string, messages: ChatMessage[]): void {
  try {
    const slice = messages.slice(-LS_MAX_MSGS);
    localStorage.setItem(`${LS_PREFIX}${chatId}`, JSON.stringify(slice));
  } catch { /* Ignore quota errors */ }
}

/** Load persisted messages from localStorage. Returns [] if nothing cached. */
export function loadCacheFromLS(chatId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}${chatId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    // Rehydrate Date objects serialized by JSON.stringify
    return parsed.map((m) => ({ ...m, createdAt: new Date(m.createdAt) }));
  } catch {
    return [];
  }
}

async function notifyStudyGroupMembers(groupId: string, senderId: string, messageText: string) {
  try {
    const groupRef = doc(db, 'studyGroups', groupId);
    const groupSnap = await getDoc(groupRef);
    if (!groupSnap.exists()) return;

    const groupData = groupSnap.data() as { name?: string; members?: string[] };
    const members = Array.isArray(groupData.members) ? groupData.members : [];
    const preview = (messageText || '').trim();
    const safePreview = preview.length > 80 ? `${preview.slice(0, 80)}...` : preview;

    const writes = members
      .filter((uid) => uid && uid !== senderId)
      .map((uid) => {
        const notifRef = doc(collection(db, `notifications/${uid}/items`));
        return setDoc(notifRef, {
          title: `New message in ${groupData.name || 'Study Group'}`,
          message: safePreview || 'You have a new study group message.',
          type: 'study_group_message',
          createdAt: Timestamp.now(),
          read: false,
          meta: { groupId }
        });
      });

    await Promise.all(writes);
  } catch (error) {
    console.warn('[chatService] study group notification failed:', error);
  }
}

/** Get cached messages for a chat. Returns empty array if not cached. */
export function getCachedMessages(chatId: string): ChatMessage[] {
  return messageCache.get(chatId) || [];
}

/** Merge new messages into the cache, deduplicating by id */
function mergeToCacheInner(chatId: string, incoming: ChatMessage[]): ChatMessage[] {
  const existing = messageCache.get(chatId) || [];
  const byId = new Map<string, ChatMessage>();

  // Existing first, then incoming overwrites (server data wins)
  for (const msg of existing) byId.set(msg.id, msg);
  for (const msg of incoming) {
    const prev = byId.get(msg.id);
    // Keep optimistic message's text if server hasn't returned decrypted version yet
    if (prev?._optimistic && !msg._optimistic) {
      byId.set(msg.id, { ...msg, text: msg.text || prev.text });
    } else {
      byId.set(msg.id, msg);
    }
  }

  const merged = Array.from(byId.values()).sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );
  messageCache.set(chatId, merged);
  // Persist to localStorage in the background (fire-and-forget)
  try { persistToLS(chatId, merged); } catch {}
  return merged;
}

// ─── Listen to Messages (Real-Time) ─────────────────────────────────────────

/**
 * Subscribe to real-time messages for a specific chatId.
 * Only fetches latest PAGE_SIZE messages initially.
 * Returns an unsubscribe function.
 */
export function listenToMessages(
  chatId: string,
  onUpdate: (messages: ChatMessage[]) => void,
  pageSize: number = PAGE_SIZE,
  isGroup: boolean = false
): () => void {
  if (!isFirebaseConfigured || !chatId) return () => {};

  const uid = auth.currentUser?.uid;
  if (!uid) return () => {};

  const path = isGroup ? `studyGroups/${chatId}/messages` : `conversations/${chatId}/messages`;
  const messagesRef = collection(db, path);
  const q = query(
    messagesRef,
    orderBy('timestamp', 'desc'),
    limit(pageSize)
  );

  const unsub = onSnapshot(
    q,
    (snapshot) => {
      const incoming: ChatMessage[] = [];
      let oldest: QueryDocumentSnapshot | null = null;

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        incoming.push({
          id: docSnap.id,
          chatId,
          text: data.content || '',
          encryptedContent: data.content,
          senderId: data.senderId || '',
          receiverId: data.receiverId || '',
          createdAt: data.timestamp?.toDate?.() || new Date(),
          status: data.status || (data.read ? 'seen' : 'sent'),
          read: data.read ?? false,
          replyTo: data.replyTo || null,
        });
        oldest = docSnap; // last doc in desc order = oldest
      });

      // Store oldest doc ref for pagination
      if (oldest) {
        oldestDocCache.set(chatId, oldest);
      }

      // Reverse to chronological order (asc) for display
      incoming.reverse();

      const merged = mergeToCacheInner(chatId, incoming);
      onUpdate(merged);
    },
    (error) => {
      console.error(`[chatService] Error listening to messages for ${chatId}:`, error);
      // Return cached data on error
      onUpdate(getCachedMessages(chatId));
    }
  );

  return unsub;
}

// ─── Load More Messages (Pagination) ────────────────────────────────────────

/**
 * Load older messages before the current oldest cached message.
 * Returns the loaded messages (already merged into cache).
 */
export async function loadMoreMessages(
  chatId: string,
  isGroup: boolean = false
): Promise<ChatMessage[]> {
  if (!isFirebaseConfigured || !chatId) return [];

  const oldestDoc = oldestDocCache.get(chatId);
  if (!oldestDoc) return []; // No more to load

  const path = isGroup ? `studyGroups/${chatId}/messages` : `conversations/${chatId}/messages`;
  const messagesRef = collection(db, path);
  const q = query(
    messagesRef,
    orderBy('timestamp', 'desc'),
    startAfter(oldestDoc),
    limit(PAGE_SIZE)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    oldestDocCache.set(chatId, null); // No more pages
    return getCachedMessages(chatId);
  }

  const older: ChatMessage[] = [];
  let newOldest: QueryDocumentSnapshot | null = null;

  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    older.push({
      id: docSnap.id,
      chatId,
      text: data.content || '',
      encryptedContent: data.content,
      senderId: data.senderId || '',
      receiverId: data.receiverId || '',
      createdAt: data.timestamp?.toDate?.() || new Date(),
      status: data.status || (data.read ? 'seen' : 'sent'),
      read: data.read ?? false,
      replyTo: data.replyTo || null,
    });
    newOldest = docSnap;
  });

  if (newOldest) {
    oldestDocCache.set(chatId, newOldest);
  }

  older.reverse();
  return mergeToCacheInner(chatId, older);
}

/**
 * Check if there are more messages to load for a given chat.
 */
export function hasMoreMessages(chatId: string): boolean {
  return oldestDocCache.get(chatId) !== null;
}

// ─── Send Message (Optimistic) ──────────────────────────────────────────────

/**
 * Send a message with optimistic UI.
 * 1. Immediately adds the message to the local cache with status "sending"
 * 2. Writes to Firestore in background
 * 3. On failure, marks as "failed" and schedules retry
 *
 * @param chatId       Conversation ID
 * @param plainText    The unencrypted message text (for UI display)
 * @param contentToSend The encrypted content to write to Firestore
 * @param onUpdate     Callback to push updated message list to UI
 */
export async function sendMessageOptimistic(
  chatId: string,
  plainText: string,
  contentToSend: string,
  onUpdate: (messages: ChatMessage[]) => void,
  isGroup: boolean = false,
  replyTo?: { id: string; text: string; senderName: string } | null
): Promise<string | null> {
  if (!isFirebaseConfigured || !auth.currentUser) return null;

  const senderId = auth.currentUser.uid;
  const tempId = `opt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();

  // Get the receiver from the conversation
  let receiverId = '';
  try {
    const convDoc = await getDoc(doc(db, 'conversations', chatId));
    if (convDoc.exists()) {
      const participants = convDoc.data().participants || [];
      receiverId = participants.find((id: string) => id !== senderId) || '';
    }
  } catch {
    // Non-blocking — receiver ID is nice-to-have for the optimistic message
  }

  // Step 1: Optimistic insert
  const optimistic: ChatMessage = {
    id: tempId,
    chatId,
    text: plainText,
    encryptedContent: contentToSend,
    senderId,
    receiverId,
    createdAt: now,
    status: 'sending',
    read: false,
    _optimistic: true,
    _retryCount: 0,
    replyTo: replyTo || null,
  };

  const merged = mergeToCacheInner(chatId, [optimistic]);
  onUpdate(merged);

  // Step 2: Write to Firestore
  const path = isGroup ? `studyGroups/${chatId}/messages` : `conversations/${chatId}/messages`;
  const msgDocRef = doc(collection(db, path));
  const msgData: any = {
    senderId,
    receiverId,
    content: contentToSend,
    timestamp: Timestamp.now(),
    read: false,
    status: 'sent',
  };

  if (replyTo) {
    msgData.replyTo = replyTo;
  }

  try {
    // Race between write and timeout
    const writePromise = setDoc(msgDocRef, msgData).then(() => msgDocRef.id);
    const timeoutPromise = new Promise<string>((resolve) => {
      setTimeout(() => resolve(msgDocRef.id), 6000);
    });
    const realId = await Promise.race([writePromise, timeoutPromise]);

    // Replace optimistic message with real ID
    const cache = messageCache.get(chatId) || [];
    const updated = cache.map((m) =>
      m.id === tempId
        ? { ...m, id: realId, status: 'sent' as MessageStatus, _optimistic: false }
        : m
    );
    messageCache.set(chatId, updated);
    onUpdate(updated);

    // Update conversation lastMessage (fire-and-forget)
    updateDoc(doc(db, 'conversations', chatId), {
      lastMessage: {
        content: contentToSend,
        timestamp: Timestamp.now(),
        senderId,
        read: false,
      },
    }).catch((err) => console.warn('[chatService] lastMessage update failed:', err));

    if (isGroup) {
      notifyStudyGroupMembers(chatId, senderId, plainText).catch(() => {});
    }

    return realId;
  } catch (error) {
    console.error('[chatService] Message send failed:', error);

    // Mark as failed
    const cache = messageCache.get(chatId) || [];
    const updated = cache.map((m) =>
      m.id === tempId ? { ...m, status: 'failed' as MessageStatus } : m
    );
    messageCache.set(chatId, updated);
    onUpdate(updated);

    // Schedule auto-retry
    scheduleRetry(chatId, tempId, contentToSend, receiverId, onUpdate);

    return null;
  }
}

/** Auto-retry failed messages with exponential backoff */
function scheduleRetry(
  chatId: string,
  tempId: string,
  contentToSend: string,
  receiverId: string,
  onUpdate: (messages: ChatMessage[]) => void
) {
  const cache = messageCache.get(chatId) || [];
  const msg = cache.find((m) => m.id === tempId);
  if (!msg) return;

  const retryCount = msg._retryCount || 0;
  if (retryCount >= RETRY_DELAYS.length) return; // Give up after max retries

  const delay = RETRY_DELAYS[retryCount];

  setTimeout(async () => {
    const currentCache = messageCache.get(chatId) || [];
    const currentMsg = currentCache.find((m) => m.id === tempId);
    if (!currentMsg || currentMsg.status !== 'failed') return;

    // Update status to 'sending' for retry
    const retrying = currentCache.map((m) =>
      m.id === tempId
        ? { ...m, status: 'sending' as MessageStatus, _retryCount: retryCount + 1 }
        : m
    );
    messageCache.set(chatId, retrying);
    onUpdate(retrying);

    try {
      const senderId = auth.currentUser?.uid;
      if (!senderId) return;

      const msgDocRef = doc(collection(db, `conversations/${chatId}/messages`));
      await setDoc(msgDocRef, {
        senderId,
        receiverId,
        content: contentToSend,
        timestamp: Timestamp.now(),
        read: false,
        status: 'sent',
      });

      const realId = msgDocRef.id;
      const updatedCache = (messageCache.get(chatId) || []).map((m) =>
        m.id === tempId
          ? { ...m, id: realId, status: 'sent' as MessageStatus, _optimistic: false }
          : m
      );
      messageCache.set(chatId, updatedCache);
      onUpdate(updatedCache);

      // Update lastMessage
      updateDoc(doc(db, 'conversations', chatId), {
        lastMessage: {
          content: contentToSend,
          timestamp: Timestamp.now(),
          senderId,
          read: false,
        },
      }).catch(() => {});
    } catch {
      // Still failed — mark again
      const failedAgain = (messageCache.get(chatId) || []).map((m) =>
        m.id === tempId ? { ...m, status: 'failed' as MessageStatus } : m
      );
      messageCache.set(chatId, failedAgain);
      onUpdate(failedAgain);

      // Try again if under max retries
      scheduleRetry(chatId, tempId, contentToSend, receiverId, onUpdate);
    }
  }, delay);
}

/**
 * Manually retry a specific failed message.
 */
export async function retryMessage(
  chatId: string,
  messageId: string,
  onUpdate: (messages: ChatMessage[]) => void
): Promise<void> {
  const cache = messageCache.get(chatId) || [];
  const msg = cache.find((m) => m.id === messageId);
  if (!msg || msg.status !== 'failed') return;

  // Reset retry count and re-attempt
  const updated = cache.map((m) =>
    m.id === messageId ? { ...m, _retryCount: 0 } : m
  );
  messageCache.set(chatId, updated);

  scheduleRetry(chatId, messageId, msg.encryptedContent || msg.text, msg.receiverId || '', onUpdate);
}

// ─── Mark as Seen (Read Receipts) ───────────────────────────────────────────

/**
 * Mark all unread messages from the other user as "seen".
 * Uses a batch write for efficiency.
 */
export async function markAsSeen(chatId: string): Promise<void> {
  if (!isFirebaseConfigured || !auth.currentUser || !chatId) return;

  const userId = auth.currentUser.uid;
  const messagesRef = collection(db, `conversations/${chatId}/messages`);

  const q = query(
    messagesRef,
    where('receiverId', '==', userId),
    where('read', '==', false)
  );

  try {
    const snapshot = await getDocs(q);
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.forEach((docSnap) => {
      batch.update(docSnap.ref, { read: true, status: 'seen' });
    });

    // Also update conversation lastMessage.read
    batch.update(doc(db, 'conversations', chatId), {
      'lastMessage.read': true,
    });

    await batch.commit();

    // Update local cache
    const cache = messageCache.get(chatId) || [];
    const updated = cache.map((m) =>
      m.receiverId === userId && !m.read
        ? { ...m, read: true, status: 'seen' as MessageStatus }
        : m
    );
    messageCache.set(chatId, updated);
  } catch (error) {
    console.error('[chatService] markAsSeen failed:', error);
  }
}

// ─── Typing Indicator ───────────────────────────────────────────────────────

let lastTypingWrite = 0;
let typingClearTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Send typing status. Throttled to avoid excessive writes.
 * Auto-clears after TYPING_TIMEOUT_MS.
 */
export function sendTypingStatus(chatId: string): void {
  if (!isFirebaseConfigured || !auth.currentUser || !chatId) return;

  const now = Date.now();
  const uid = auth.currentUser.uid;

  // Throttle: skip if we wrote too recently
  if (now - lastTypingWrite < TYPING_THROTTLE_MS) {
    // But still reset the clear timer
    if (typingClearTimer) clearTimeout(typingClearTimer);
    typingClearTimer = setTimeout(() => clearTypingStatus(chatId), TYPING_TIMEOUT_MS);
    return;
  }

  lastTypingWrite = now;

  // Write to conversation document
  updateDoc(doc(db, 'conversations', chatId), {
    [`typing.${uid}`]: now,
  }).catch(() => {});

  // Auto-clear after timeout
  if (typingClearTimer) clearTimeout(typingClearTimer);
  typingClearTimer = setTimeout(() => clearTypingStatus(chatId), TYPING_TIMEOUT_MS);
}

/**
 * Clear typing status for the current user.
 */
export function clearTypingStatus(chatId: string): void {
  if (!isFirebaseConfigured || !auth.currentUser || !chatId) return;

  const uid = auth.currentUser.uid;
  updateDoc(doc(db, 'conversations', chatId), {
    [`typing.${uid}`]: 0,
  }).catch(() => {});
}

/**
 * Listen for typing status changes on a conversation.
 * Returns unsubscribe function.
 * Callback receives the typing state map (userId → timestamp).
 */
export function listenToTyping(
  chatId: string,
  onTyping: (typing: TypingState) => void
): () => void {
  if (!isFirebaseConfigured || !chatId) return () => {};

  let lastTypingJson = '';
  const convRef = doc(db, 'conversations', chatId);

  return onSnapshot(
    convRef,
    (docSnap) => {
      const data = docSnap.data();
      const typing: TypingState = data?.typing || {};
      // Skip re-render if typing state hasn't changed
      const json = JSON.stringify(typing);
      if (json === lastTypingJson) return;
      lastTypingJson = json;
      onTyping(typing);
    },
    () => onTyping({})
  );
}

/**
 * Check if a given user is currently typing based on the typing state.
 * Returns true if their typing timestamp is within TYPING_TIMEOUT_MS.
 */
export function isUserTyping(typingState: TypingState, userId: string): boolean {
  const ts = typingState[userId] || 0;
  if (ts === 0) return false;
  return Date.now() - ts < TYPING_TIMEOUT_MS;
}

// ─── Clear Cache ────────────────────────────────────────────────────────────

/** Clear the message cache for a specific chat or all chats */
export function clearCache(chatId?: string): void {
  if (chatId) {
    messageCache.delete(chatId);
    oldestDocCache.delete(chatId);
  } else {
    messageCache.clear();
    oldestDocCache.clear();
  }
}
