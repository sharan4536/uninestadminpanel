import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  limit,
  Timestamp,
  collectionGroup,
  arrayUnion,
  arrayRemove,
  writeBatch,
  increment,
  QuerySnapshot,
  DocumentData,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getUniversityConfig } from '../../config/universities';
import { db, auth, storage, isFirebaseConfigured } from './client';
import { formatEmailToName } from '../nameUtils';
import { deriveConversationKey, encryptMessage, decryptMessage } from '../crypto';
import { syncWidgetData } from '../widgetSync';
export { db };
import { User, onAuthStateChanged } from 'firebase/auth';

// Types
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  publicKey?: string; // JWK string
  major?: string;
  year?: string;
  bio?: string;
  interests?: string[];
  clubs?: string[]; // Added clubs field
  university?: string;
  /** Canonical university config ID, e.g. 'vit-vellore'. Used for data scoping. */
  universityId?: string;
  status?: 'in class' | 'in library' | 'in ground' | 'in hostel' | 'available';
  location?: {
    lat: number;
    lng: number;
    name?: string;
    timestamp?: Timestamp;
  };
  lastActive?: Timestamp;
  createdAt: Timestamp;
  privacySettings?: {
    ghostMode?: boolean;
    locationVisible?: boolean;
    onlineStatusVisible?: boolean;
    discoverVisible?: boolean;
    timetableVisible?: boolean;
    blockedUsers?: string[];
  };
  fcmToken?: string;
  name?: string;
  isAdmin?: boolean;
  isSuspended?: boolean;
  isVerified?: boolean;
  online?: boolean;
  isDevelopmentUser?: boolean;
}

export interface FriendRequest {
  id?: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Timestamp;
}

export interface Message {
  id?: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: Timestamp;
  read: boolean;
}

// Event Types
export interface CampusEvent {
  id: string;
  title: string;
  description: string;
  clubId: string;
  clubName: string;
  startTime: Timestamp;
  endTime: Timestamp;
  location: string;
  universityId?: string;
  collegeId?: string;
  registrationLink?: string;
  stats: {
    attending: number;
    interested: number;
    views: number;
  };
  tags: string[];
  vibeTags?: string[];
  bannerUrl?: string; // Standardized to bannerUrl per requirements
  isFeatured?: boolean;
  isTrending?: boolean;
  isSponsored?: boolean;
  expiresAt?: Timestamp;
  createdBy: string;
  createdAt: Timestamp;
}

export interface Advertisement {
  id?: string;
  title: string;
  brandName: string;
  description: string;
  location: {
    lat: number;
    lng: number;
    name?: string;
  };
  radius: number; // in meters
  imageUrl: string;
  bannerText?: string; // Promo text shown on map overlay (e.g. "50% off today!")
  ctaLink?: string;
  ctaText?: string;
  type: 'in-campus' | 'out-campus';
  startDate: Timestamp;
  endDate: Timestamp;
  status: 'active' | 'inactive' | 'scheduled';
  stats: {
    impressions: number;
    clicks: number;
  };
  createdBy: string;
  createdAt: Timestamp;
  targetUniversityId?: string; // Target specific university
}

export interface AdminNotification {
  id?: string;
  title: string;
  message: string;
  imageUrl?: string;
  redirectLink?: string; // event/map/ad link
  targetGroups?: {
    year?: string[];
    major?: string[];
    interests?: string[];
  };
  targetUniversityId?: string;
  type: 'event' | 'announcement' | 'promotion';
  status: 'sent' | 'scheduled' | 'draft';
  scheduledAt?: Timestamp;
  sentAt?: Timestamp;
  createdBy: string;
  createdAt: Timestamp;
}

export interface AdAnalytics {
  id?: string;
  adId: string;
  impressions: number;
  clicks: number;
  date: string; // YYYY-MM-DD
}

export interface AdminUser {
  uid: string;
  role: 'super-admin' | 'event-manager' | 'marketing-manager';
  permissions: string[];
}

export interface EventAttendee {
  id?: string;
  eventId: string;
  userId: string;
  status: 'attending' | 'interested';
  isGoingAlone: boolean;
  isPair?: boolean;
  linkedWith?: string | null;
  updatedAt: Timestamp;
}

export interface EventChatMessage {
  id?: string;
  eventId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  timestamp: Timestamp;
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage?: {
    content: string;
    timestamp: Timestamp;
    senderId: string;
    read?: boolean;
  };
  createdAt: Timestamp;
}

// Connect Features Types
export interface Pulse {
  id?: string;
  text: string;
  createdBy: string;
  location?: string;
  vibe?: string;
  crowdMin?: number;
  crowdMax?: number;
  isPublic?: boolean;
  durationMinutes?: number;
  expiresAt: Timestamp;
  createdAt: Timestamp;
  joinRequests?: string[];
  participants?: string[];
}

export interface SOSAlert {
  id?: string;
  course: string;
  topic: string;
  createdBy: string;
  expiresAt: Timestamp;
  createdAt: Timestamp;
}

export interface CheckIn {
  id?: string;
  location: string;
  note?: string;
  createdBy: string;
  expiresAt: Timestamp;
  createdAt: Timestamp;
}

export interface UniversityRequest {
  id?: string;
  universityName: string;
  location: string;
  requestedByUid?: string | null;
  requestedByEmail?: string | null;
  status?: 'pending' | 'reviewed' | 'added';
  createdAt?: Timestamp;
}

// Collections
const usersCollection = isFirebaseConfigured ? collection(db, 'users') : (undefined as any);
const friendRequestsCollection = isFirebaseConfigured ? collection(db, 'friendRequests') : (undefined as any);
const conversationsCollection = isFirebaseConfigured ? collection(db, 'conversations') : (undefined as any);
const messagesCollection = isFirebaseConfigured ? collection(db, 'messages') : (undefined as any);
const eventsCollection = isFirebaseConfigured ? collection(db, 'events') : (undefined as any);
const eventAttendeesCollection = isFirebaseConfigured ? collection(db, 'eventAttendees') : (undefined as any);
const eventChatsCollection = isFirebaseConfigured ? collection(db, 'eventChats') : (undefined as any);
const adsCollection = isFirebaseConfigured ? collection(db, 'ads') : (undefined as any);
const adminNotificationsCollection = isFirebaseConfigured ? collection(db, 'adminNotifications') : (undefined as any);
const userNotificationsCollection = isFirebaseConfigured ? collection(db, 'notifications') : (undefined as any);
const universityRequestsCollection = isFirebaseConfigured ? collection(db, 'universityRequests') : (undefined as any);

const adAnalyticsCollection = isFirebaseConfigured ? collection(db, 'adAnalytics') : (undefined as any);
const adminUsersCollection = isFirebaseConfigured ? collection(db, 'adminUsers') : (undefined as any);
const settingsCollection = isFirebaseConfigured ? collection(db, 'settings') : (undefined as any);


// Helper: email verification is sufficient for messaging
const isVerifiedEmailUser = () => {
  if (!isFirebaseConfigured) return true;
  return !!(auth && auth.currentUser && auth.currentUser.emailVerified);
};

export const submitUniversityRequest = async (data: Pick<UniversityRequest, 'universityName' | 'location'>) => {
  if (!isFirebaseConfigured) return false;

  const universityName = data.universityName?.trim();
  const location = data.location?.trim();
  if (!universityName || !location) return false;

  const currentUser = (auth as any)?.currentUser;

  try {
    await addDoc(universityRequestsCollection, {
      universityName,
      location,
      requestedByUid: currentUser?.uid || null,
      requestedByEmail: currentUser?.email || null,
      status: 'pending',
      createdAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('Error submitting university request:', error);
    return false;
  }
};

// User Profile Functions
export const createUserProfile = async (user: User, additionalData?: Partial<UserProfile>) => {
  if (!isFirebaseConfigured) return;
  if (!user.uid) return;

  const userRef = doc(usersCollection, user.uid);
  const userSnapshot = await getDoc(userRef);

  if (!userSnapshot.exists()) {
    const { email, displayName, photoURL } = user;

    try {
      await setDoc(userRef, {
        uid: user.uid,
        email,
        displayName: additionalData?.name || displayName || formatEmailToName(email),
        name: additionalData?.name || displayName || formatEmailToName(email),
        photoURL: photoURL || null,
        createdAt: serverTimestamp(),
        lastActive: serverTimestamp(),
        ...additionalData
      });
      console.log('User profile created successfully');
    } catch (error) {
      console.error('Error creating user profile:', error);
    }
  } else {
    // Update last active
    await updateDoc(userRef, {
      lastActive: serverTimestamp()
    });
  }

  return userRef;
};

export const getUserProfile = async (userId: string) => {
  if (!isFirebaseConfigured) return null;
  if (!userId) return null;

  const userRef = doc(usersCollection, userId);
  const userSnapshot = await getDoc(userRef);

  if (userSnapshot.exists()) {
    const userData = userSnapshot.data();
    return {
      uid: userSnapshot.id,
      ...userData
    } as UserProfile;
  }

  return null;
};

export const updateUserProfile = async (userId: string, data: Partial<UserProfile>) => {
  if (!isFirebaseConfigured) return;
  if (!userId) return;

  const userRef = doc(usersCollection, userId);
  try {
    const updatePayload: any = { ...data, lastActive: serverTimestamp() };
    if (data.name && !data.displayName) updatePayload.displayName = data.name;
    if (data.displayName && !data.name) updatePayload.name = data.displayName;

    // Firestore rejects undefined values — strip them out
    Object.keys(updatePayload).forEach(key => {
      if (updatePayload[key] === undefined) delete updatePayload[key];
    });

    await updateDoc(userRef, updatePayload);
    console.log('User profile updated successfully');
  } catch (error) {
    console.error('Error updating user profile:', error);
  }
};

// Update profile in the profiles collection (used by ProfilePage)
export const updateProfile = async (userId: string, data: any) => {
  if (!isFirebaseConfigured) return;
  if (!userId) return;

  const profileRef = doc(db, 'profiles', userId);
  try {
    await setDoc(profileRef, {
      ...data,
      id: userId
    }, { merge: true });
    console.log('Profile updated successfully in profiles collection');
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
};

// Get profile from the profiles collection (used by ProfilePage)
export const getProfile = async (userId: string): Promise<UserProfile | null> => {
  if (!isFirebaseConfigured) return null;
  if (!userId) return null;

  const profileRef = doc(db, 'profiles', userId);
  try {
    const profileSnap = await getDoc(profileRef);
    if (profileSnap.exists()) {
      console.log('Profile loaded successfully from profiles collection');
      return { uid: profileSnap.id, ...profileSnap.data() } as UserProfile;
    } else {
      console.log('No profile found in profiles collection');
      return null;
    }
  } catch (error) {
    console.error('Error getting profile:', error);
    throw error;
  }
};

// Friend Requests Functions
export const sendFriendRequest = async (receiverId: string) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) return;

  const senderId = auth.currentUser.uid;

  // Check if request already exists
  const q = query(
    friendRequestsCollection,
    where('senderId', '==', senderId),
    where('receiverId', '==', receiverId)
  );

  const existingRequests = await getDocs(q);
  if (!existingRequests.empty) {
    console.log('Friend request already sent');
    return;
  }

  try {
    await addDoc(friendRequestsCollection, {
      senderId,
      receiverId,
      status: 'pending',
      createdAt: serverTimestamp()
    });
    console.log('Friend request sent successfully');
  } catch (error) {
    console.error('Error sending friend request:', error);
  }
};

export const respondToFriendRequest = async (requestId: string, status: 'accepted' | 'rejected') => {
  if (!isFirebaseConfigured) return;
  if (!requestId) return;

  const requestRef = doc(friendRequestsCollection, requestId);

  try {
    await updateDoc(requestRef, { status });
    console.log(`Friend request ${status} successfully`);
  } catch (error) {
    console.error(`Error ${status} friend request:`, error);
  }
};

// Enhanced function to accept friend request and create conversation
export const acceptFriendRequest = async (requestId: string, senderId: string) => {
  if (!isFirebaseConfigured || !requestId || !senderId || !(auth as any)?.currentUser) return false;

  try {
    // Update friend request status
    const requestRef = doc(friendRequestsCollection, requestId);
    await updateDoc(requestRef, { status: 'accepted' });

    // Create conversation between users
    const conversationId = await createConversation(senderId);

    console.log('Friend request accepted and conversation created successfully');
    return { success: true, conversationId };
  } catch (error) {
    console.error('Error accepting friend request:', error);
    return { success: false, error };
  }
};

// Enhanced function to ignore/reject friend request
export const ignoreFriendRequest = async (requestId: string) => {
  if (!isFirebaseConfigured) return false;
  if (!requestId) return false;

  try {
    const requestRef = doc(friendRequestsCollection, requestId);
    await updateDoc(requestRef, { status: 'rejected' });

    console.log('Friend request ignored successfully');
    return { success: true };
  } catch (error) {
    console.error('Error ignoring friend request:', error);
    return { success: false, error };
  }
};

export const getFriendRequests = (callback: (requests: FriendRequest[]) => void) => {
  if (!isFirebaseConfigured) return () => { };
  const isUserFullyAuthenticated = isVerifiedEmailUser();
  if (!isUserFullyAuthenticated) return () => { };

  const userId = auth.currentUser.uid;

  // Get received requests
  const q = query(
    friendRequestsCollection,
    where('receiverId', '==', userId),
    where('status', '==', 'pending')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const requests: FriendRequest[] = [];
      snapshot.forEach((doc) => {
        requests.push({ id: doc.id, ...(doc.data() as any) } as FriendRequest);
      });
      callback(requests);
    },
    (error) => {
      console.error('Error subscribing to friend requests:', error);
      callback([]);
    }
  );
};

export const getFriends = (callback: (friends: UserProfile[]) => void) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) return () => { };

  const userId = auth.currentUser.uid;

  // Queries for accepted requests where the current user is sender or receiver
  const q1 = query(
    friendRequestsCollection,
    where('senderId', '==', userId),
    where('status', '==', 'accepted')
  );
  const q2 = query(
    friendRequestsCollection,
    where('receiverId', '==', userId),
    where('status', '==', 'accepted')
  );
  // Backward compatibility: support legacy schema with boolean `accepted: true`
  const q1Legacy = query(
    friendRequestsCollection,
    where('senderId', '==', userId),
    where('accepted', '==', true)
  );
  const q2Legacy = query(
    friendRequestsCollection,
    where('receiverId', '==', userId),
    where('accepted', '==', true)
  );

  // Track both sides and emit a UNION list to the callback
  let senderAcceptedIds: string[] = [];
  let receiverAcceptedIds: string[] = [];
  let senderAcceptedLegacyIds: string[] = [];
  let receiverAcceptedLegacyIds: string[] = [];

  const emitUnion = async () => {
    const allIds = Array.from(new Set([
      ...senderAcceptedIds,
      ...receiverAcceptedIds,
      ...senderAcceptedLegacyIds,
      ...receiverAcceptedLegacyIds,
    ]));
    
    // Fetch all profiles in parallel
    const friendProfiles = await Promise.all(allIds.map(id => getUserProfile(id)));
    const friends = friendProfiles.filter((f): f is UserProfile => f !== null);
    
    callback(friends);
  };

  const unsubscribe1 = onSnapshot(
    q1,
    async (snapshot) => {
      senderAcceptedIds = snapshot.docs.map((d) => {
        const data: any = d.data() as any;
        return data.receiverId as string;
      });
      await emitUnion();
    },
    (error) => {
      console.error('Error subscribing to sent accepted friend requests:', error);
      callback([]);
    }
  );

  const unsubscribe2 = onSnapshot(
    q2,
    async (snapshot) => {
      receiverAcceptedIds = snapshot.docs.map((d) => {
        const data: any = d.data() as any;
        return data.senderId as string;
      });
      await emitUnion();
    },
    (error) => {
      console.error('Error subscribing to received accepted friend requests:', error);
      callback([]);
    }
  );

  const unsubscribe3 = onSnapshot(
    q1Legacy,
    async (snapshot) => {
      senderAcceptedLegacyIds = snapshot.docs.map((d) => {
        const data: any = d.data() as any;
        return (data.receiverId || data.receiver || data.to) as string;
      }).filter(Boolean);
      await emitUnion();
    },
    (error) => {
      console.error('Error subscribing to sent accepted (legacy) friend requests:', error);
      callback([]);
    }
  );

  const unsubscribe4 = onSnapshot(
    q2Legacy,
    async (snapshot) => {
      receiverAcceptedLegacyIds = snapshot.docs.map((d) => {
        const data: any = d.data() as any;
        return (data.senderId || data.sender || data.from) as string;
      }).filter(Boolean);
      await emitUnion();
    },
    (error) => {
      console.error('Error subscribing to received accepted (legacy) friend requests:', error);
      callback([]);
    }
  );

  return () => {
    unsubscribe1();
    unsubscribe2();
    unsubscribe3();
    unsubscribe4();
  };
};

// Get all registered users (excluding the current user) via realtime subscription
export const getAllUsers = (callback: (users: UserProfile[]) => void, universityId?: string) => {
  if (!isFirebaseConfigured || !auth.currentUser) return () => { };

  const currentUserId = (auth as any).currentUser.uid;

  const constraints: any[] = [
    orderBy('createdAt', 'desc'),
    limit(50)
  ];

  if (universityId) {
    constraints.unshift(where('universityId', '==', universityId));
  }

  const q = query(
    usersCollection,
    ...constraints
  );

  const unsubscribe = onSnapshot(
    q,
    async (snapshot: any) => {
      try {
        const userRef = doc(db, 'profiles', currentUserId);
        const userSnap = await getDoc(userRef);
        const blockedUsers = userSnap.data()?.privacySettings?.blockedUsers || [];

        const users: UserProfile[] = [];
        snapshot.forEach((docSnap: any) => {
          const data = docSnap.data() as UserProfile;
          if (!data?.uid || data.uid === currentUserId) return;
          if (blockedUsers.includes(data.uid)) return; // Filter blocked users
          users.push(data);
        });
        callback(users);
      } catch (e) {
        console.error('Error fetching blocked users in getAllUsers:', e);
      }
    },
    (error: any) => {
      console.error('Error subscribing to all users:', error);
      callback([]);
    }
  );

  return () => {
    unsubscribe();
  };
};

// Get absolutely all users for the Admin panel (no limit, includes current user)
export const getAllUsersAdmin = (callback: (users: UserProfile[]) => void) => {
  if (!isFirebaseConfigured || !auth.currentUser) return () => { };

  const q = query(
    usersCollection,
    orderBy('createdAt', 'desc')
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot: any) => {
      const users: UserProfile[] = [];
      snapshot.forEach((docSnap: any) => {
        const data = docSnap.data() as UserProfile;
        if (!data?.uid) return;
        users.push(data);
      });
      callback(users);
    },
    (error: any) => {
      console.error('Error subscribing to admin users list:', error);
      callback([]);
    }
  );

  return () => {
    unsubscribe();
  };
};


// Messaging Functions
export const createConversation = async (participantId: string) => {
  if (!isFirebaseConfigured) return null;
  // Check comprehensive authentication requirements to match Firestore security rules
  // Force token refresh to ensure up-to-date email_verified claim in Firestore
  if ((auth as any)?.currentUser) {
    try { await (auth as any).currentUser.getIdToken(true); } catch { }
  }
  const isUserFullyAuthenticated = isVerifiedEmailUser();
  if (!isUserFullyAuthenticated || !auth.currentUser) {
    throw new Error('Authentication required');
  }

  const currentUserId = auth.currentUser.uid;
  const participants = [currentUserId, participantId].sort();

  // Check if conversation already exists
  const q = query(
    conversationsCollection,
    where('participants', '==', participants)
  );

  const existingConversations = await getDocs(q);
  if (!existingConversations.empty) {
    return existingConversations.docs[0].id;
  }

  try {
    const newDocRef = doc(conversationsCollection);
    const writePromise = setDoc(newDocRef, {
      participants,
      createdAt: Timestamp.now()
    }).then(() => newDocRef.id);
    const timeoutPromise = new Promise<string>((resolve) => {
      setTimeout(() => resolve(newDocRef.id), 5000);
    });
    const convId = await Promise.race([writePromise, timeoutPromise]);
    console.log('Conversation created successfully');
    return convId;
  } catch (error) {
    console.error('Error creating conversation:', error);
    return null;
  }
};

export const deleteConversationWithMessages = async (conversationId: string) => {
  if (!isFirebaseConfigured || !auth.currentUser || !conversationId) return false;
  try {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const messagesSnap = await getDocs(messagesRef);

    if (!messagesSnap.empty) {
      const batch = writeBatch(db);
      messagesSnap.docs.forEach((messageDoc) => batch.delete(messageDoc.ref));
      await batch.commit();
    }

    await deleteDoc(doc(db, 'conversations', conversationId));
    return true;
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return false;
  }
};

export const sendMessage = async (conversationId: string, content: string) => {
  if (!isFirebaseConfigured) throw new Error('Firebase not configured');
  // Check comprehensive authentication requirements to match Firestore security rules
  // Force token refresh to ensure up-to-date email_verified claim in Firestore
  if ((auth as any)?.currentUser) {
    try { await (auth as any).currentUser.getIdToken(true); } catch { }
  }
  const isUserFullyAuthenticated = isVerifiedEmailUser();

  if (!isUserFullyAuthenticated || !conversationId) {
    throw new Error('Authentication required: User must be signed in with a verified VIT email account');
  }

  const senderId = (auth as any).currentUser.uid;

  try {
    // Get conversation to find receiver
    const conversationRef = doc(conversationsCollection, conversationId);
    const conversationSnapshot = await getDoc(conversationRef);

    if (!conversationSnapshot.exists()) {
      console.error('Conversation does not exist');
      return;
    }

    const conversationData = conversationSnapshot.data();
    const receiverId = conversationData.participants.find((id: string) => id !== senderId);

    // Encrypt message content before sending
    let finalContent = content;
    try {
      const sharedKey = await deriveConversationKey(senderId, receiverId);
      finalContent = await encryptMessage(content, sharedKey);
    } catch (encryptErr) {
      console.error('Encryption failed, sending as plain text:', encryptErr);
    }

    // Add message with timeout to prevent hanging on Android
    const msgDocRef = doc(collection(db, `conversations/${conversationId}/messages`));
    const msgData = {
      senderId,
      receiverId,
      content: finalContent,
      timestamp: Timestamp.now(),
      read: false
    };
    const writeMsg = setDoc(msgDocRef, msgData).then(() => msgDocRef.id);
    const timeoutMsg = new Promise<string>((resolve) => {
      setTimeout(() => resolve(msgDocRef.id), 5000);
    });
    const messageId = await Promise.race([writeMsg, timeoutMsg]);

    // Update conversation with last message (fire-and-forget, don't block)
    updateDoc(conversationRef, {
      lastMessage: {
        content: finalContent,
        timestamp: Timestamp.now(),
        senderId,
        read: false
      }
    }).catch((err) => console.warn('Failed to update lastMessage:', err));

    console.log('Message sent successfully');
    return messageId;
  } catch (error) {
    console.error('Error sending message:', error);
  }
};

export const getConversations = (callback: (conversations: Conversation[]) => void) => {
  if (!isFirebaseConfigured) return () => { };
  // Check comprehensive authentication requirements to match Firestore security rules
  // Trigger token refresh (non-blocking) to update claims before reads
  if ((auth as any)?.currentUser) {
    (auth as any).currentUser.getIdToken(true).catch(() => { });
  }
  const isUserFullyAuthenticated = isVerifiedEmailUser();

  if (!isUserFullyAuthenticated) return () => { };

  const userId = (auth as any).currentUser.uid;

  // Avoid composite index requirement by removing server-side ordering
  const q = query(
    conversationsCollection,
    where('participants', 'array-contains', userId)
  );

  return onSnapshot(
    q,
    async (snapshot) => {
      const currentUserId = auth.currentUser?.uid;
      if (!currentUserId) {
        callback([]);
        return;
      }

      const convPromises = snapshot.docs.map(async (d) => {
        const conv = { id: d.id, ...(d.data() as any) } as Conversation;
        
        // Decrypt last message preview if it exists
        if (conv.lastMessage?.content) {
          const otherId = conv.participants.find(id => id !== currentUserId);
          if (otherId) {
            try {
              const sharedKey = await deriveConversationKey(currentUserId, otherId);
              conv.lastMessage.content = await decryptMessage(conv.lastMessage.content, sharedKey);
            } catch (err) {
              console.warn('Failed to decrypt conversation preview:', err);
            }
          }
        }
        return conv;
      });

      const conversations = await Promise.all(convPromises);

      // Sort client-side by lastMessage.timestamp or createdAt
      const sorted = conversations.sort((a, b) => {
        const ta = a.lastMessage?.timestamp || a.createdAt;
        const tb = b.lastMessage?.timestamp || b.createdAt;
        const va = ta?.toMillis ? ta.toMillis() : (ta as any);
        const vb = tb?.toMillis ? tb.toMillis() : (tb as any);
        return vb - va;
      });
      callback(sorted);
    },
    (error) => {
      console.error('Error subscribing to conversations:', error);
      callback([]);
    }
  );
};

export const getMessages = (conversationId: string, callback: (messages: Message[]) => void) => {
  if (!isFirebaseConfigured) return () => { };
  if (!conversationId) return () => { };
  // Ensure claims (like email_verified) are fresh before reads
  if ((auth as any)?.currentUser) {
    (auth as any).currentUser.getIdToken(true).catch(() => { });
  }
  const isUserFullyAuthenticated = !!((auth as any)?.currentUser && (auth as any).currentUser.emailVerified);
  if (!isUserFullyAuthenticated) return () => { };

  const messagesRef = collection(db, `conversations/${conversationId}/messages`);
  const q = query(messagesRef, orderBy('timestamp', 'asc'));

  let sharedKey: CryptoKey | null = null;
  let otherId: string | null = null;

  return onSnapshot(
    q,
    async (snapshot) => {
      const currentUserId = auth.currentUser?.uid;
      if (!currentUserId) return;
      
      // Get conversation to find participants for key derivation (only once)
      if (!sharedKey && !otherId) {
        const conversationRef = doc(conversationsCollection, conversationId);
        const conversationSnap = await getDoc(conversationRef);
        const participants = conversationSnap.exists() ? conversationSnap.data().participants : [];
        otherId = participants.find((id: string) => id !== currentUserId);
        
        if (otherId) {
          sharedKey = await deriveConversationKey(currentUserId, otherId);
        }
      }

      const msgPromises = snapshot.docs.map(async (d) => {
        const msg = { id: d.id, ...(d.data() as any) } as Message;
        
        if (sharedKey && msg.content) {
          try {
            msg.content = await decryptMessage(msg.content, sharedKey);
          } catch (err) {
            console.warn('Failed to decrypt message:', d.id);
          }
        }
        return msg;
      });

      const messages = await Promise.all(msgPromises);
      callback(messages);
    },
    (error) => {
      console.error('Error subscribing to messages:', error);
      callback([]);
    }
  );
};

export const markMessagesAsRead = async (conversationId: string) => {
  if (!isFirebaseConfigured) return;
  // Check comprehensive authentication requirements to match Firestore security rules
  // Force token refresh to ensure up-to-date email_verified claim in Firestore
  if ((auth as any)?.currentUser) {
    try { await (auth as any).currentUser.getIdToken(true); } catch { }
  }
  const isUserFullyAuthenticated = isVerifiedEmailUser();

  if (!isUserFullyAuthenticated || !conversationId) return;

  const userId = (auth as any).currentUser.uid;
  const messagesRef = collection(db, `conversations/${conversationId}/messages`);

  const q = query(
    messagesRef,
    where('receiverId', '==', userId),
    where('read', '==', false)
  );

  const unreadMessages = await getDocs(q);

  const batch = writeBatch(db);
  const batchCount = unreadMessages.size;
  unreadMessages.forEach((doc) => {
    batch.update(doc.ref, { read: true });
  });

  if (batchCount > 0) {
    // Also update the conversation's lastMessage.read state so Navigation can see it
    await updateDoc(doc(db, 'conversations', conversationId), {
      'lastMessage.read': true
    });
    await batch.commit();
  }
  console.log('Messages marked as read');
};

// DEPRECATED: We now compute this client-side via getConversations to avoid composite index requirements.
export const getUnreadMessagesCount = (callback: (count: number) => void) => {
  return () => {};
};

// Location Functions
export interface FriendLocation {
  id?: string;
  uid: string;
  displayName: string;
  major?: string;
  photoURL?: string;
  location: {
    lat: number;
    lng: number;
    name?: string;
  };
  updatedAt: Timestamp;
}

// Timetable Types
export interface ClassItem {
  id: number;
  course: string;
  title: string;
  time: string;
  duration: number;
  location: string;
  academicBlock?: string;
  professor?: string;
}

export interface UserTimetable {
  uid: string;
  timetable: Record<string, ClassItem[]>; // day -> classes
  lastUpdated: Timestamp;
}

const friendLocationsCollection = isFirebaseConfigured ? collection(db, 'friendLocations') : (undefined as any);
const timetablesCollection = isFirebaseConfigured ? collection(db, 'timetables') : (undefined as any);

export const updateUserLocation = async (location: { lat: number; lng: number; name?: string }) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) return;

  const userId = (auth as any).currentUser.uid;

  try {
    // Update user profile with location
    await updateUserProfile(userId, {
      location: {
        ...location,
        timestamp: serverTimestamp() as any
      }
    });

    // Also update the friendLocations collection for real-time map updates
    const userProfile = await getUserProfile(userId);
    if (userProfile) {
      const locationRef = doc(friendLocationsCollection, userId);
      await setDoc(locationRef, {
        uid: userId,
        displayName: userProfile.displayName,
        major: userProfile.major || 'Unknown Major',
        photoURL: userProfile.photoURL || null,
        location,
        updatedAt: serverTimestamp()
      });
    }

    console.log('Location updated successfully');
  } catch (error) {
    console.error('Error updating location:', error);
  }
};

// Clear current user's location from both profile and friendLocations collection
export const clearUserLocation = async () => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) return;
  const userId = (auth as any).currentUser.uid;
  try {
    // Remove real-time location document
    const locationRef = doc(friendLocationsCollection, userId);
    await deleteDoc(locationRef);

    // Null out profile location; using null to explicitly clear in Firestore
    await updateUserProfile(userId, {
      location: null as any,
    });

    console.log('Location cleared successfully');
  } catch (error) {
    console.error('Error clearing location:', error);
  }
};

export const getFriendLocations = (callback: (locations: FriendLocation[]) => void, universityId?: string) => {
  if (!isFirebaseConfigured) return () => { };
  const isUserFullyAuthenticated = isVerifiedEmailUser();
  if (!isUserFullyAuthenticated) return () => { };

  const userId = (auth as any).currentUser.uid;

  // Get friend locations for accepted friends only
  const getFriendsAndLocations = async () => {
    // Get accepted friend requests where user is sender
    const q1 = query(
      friendRequestsCollection,
      where('senderId', '==', userId),
      where('status', '==', 'accepted')
    );

    // Get accepted friend requests where user is receiver
    const q2 = query(
      friendRequestsCollection,
      where('receiverId', '==', userId),
      where('status', '==', 'accepted')
    );

    const [senderRequests, receiverRequests] = await Promise.all([
      getDocs(q1),
      getDocs(q2)
    ]);

    // Extract friend IDs
    const friendIds = new Set<string>();
    senderRequests.forEach(doc => friendIds.add((doc.data() as any).receiverId));
    receiverRequests.forEach(doc => friendIds.add((doc.data() as any).senderId));

    // Get locations for these friends
    const locations: FriendLocation[] = [];

    // Fetch friend profiles to check privacy settings
    const profilesSnap = await getDocs(usersCollection);
    const friendProfiles = new Map<string, UserProfile>();
    profilesSnap.forEach(doc => {
      const data = doc.data() as UserProfile;
      if (friendIds.has(data.uid)) {
        friendProfiles.set(data.uid, data);
      }
    });

    const locationsSnapshot = await getDocs(friendLocationsCollection);

    locationsSnapshot.forEach(doc => {
      const data = doc.data() as FriendLocation;
      if (friendIds.has(data.uid)) {
        const profile = friendProfiles.get(data.uid);
        const isGhost = profile?.privacySettings?.ghostMode === true;
        const locationVisible = profile?.privacySettings?.locationVisible !== false;
        
        if (!isGhost && locationVisible) {
          locations.push({ id: doc.id, ...data });
        }
      }
    });

    callback(locations);
  };

  getFriendsAndLocations();

  // Return empty unsubscribe since we're not setting up a real listener here
  // Real implementation woud require complex listeners
  return () => { };
};

export const requestToJoinStudyGroup = async (groupId: string) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) return false;
  try {
    const groupRef = doc(db, 'studyGroups', groupId);
    const groupSnap = await getDoc(groupRef);
    const groupData = groupSnap.data() as StudyGroup | undefined;
    await updateDoc(groupRef, {
      joinRequests: arrayUnion((auth as any).currentUser.uid)
    });

    // Notify owner about new join request
    const ownerId = groupData?.createdBy;
    if (ownerId && ownerId !== auth.currentUser.uid) {
      const requesterName = auth.currentUser.displayName || formatEmailToName(auth.currentUser.email);
      createUserNotification(ownerId, {
        title: 'New Study Group Request',
        message: `${requesterName} requested to join "${groupData?.name || 'your study group'}"`,
        type: 'study_group_request'
      });
    }
    return true;
  } catch (error) {
    console.error('Error requesting to join study group:', error);
    return false;
  }
};

export const acceptStudyGroupRequest = async (groupId: string, userId: string) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) return false;
  try {
    const groupRef = doc(db, 'studyGroups', groupId);
    const groupSnap = await getDoc(groupRef);
    const groupData = groupSnap.data() as StudyGroup | undefined;
    await updateDoc(groupRef, {
      joinRequests: arrayRemove(userId),
      members: arrayUnion(userId)
    });

    // Notify requester they were accepted
    createUserNotification(userId, {
      title: 'Study Group Request Accepted',
      message: `You were added to "${groupData?.name || 'a study group'}"`,
      type: 'study_group_request'
    });
    return true;
  } catch (error) {
    console.error('Error accepting study group request:', error);
    return false;
  }
};

export const declineStudyGroupRequest = async (groupId: string, userId: string) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) return false;
  try {
    const groupRef = doc(db, 'studyGroups', groupId);
    const groupSnap = await getDoc(groupRef);
    const groupData = groupSnap.data() as StudyGroup | undefined;
    await updateDoc(groupRef, {
      joinRequests: arrayRemove(userId)
    });

    // Notify requester they were declined
    createUserNotification(userId, {
      title: 'Study Group Request Update',
      message: `Your request for "${groupData?.name || 'this study group'}" was declined`,
      type: 'study_group_request'
    });
    return true;
  } catch (error) {
    console.error('Error declining study group request:', error);
    return false;
  }
};

export const requestToJoinPulse = async (pulseId: string) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) return false;
  try {
    const pulseRef = doc(db, 'pulses', pulseId);
    const pulseSnap = await getDoc(pulseRef);
    const pulseData = pulseSnap.data();

    // Wrap updateDoc in a timeout to prevent hanging on Android
    const writePromise = updateDoc(pulseRef, {
      joinRequests: arrayUnion((auth as any).currentUser.uid)
    });
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 5000);
    });
    await Promise.race([writePromise, timeoutPromise]);

    // Notify the creator (fire-and-forget — don't block the join flow)
    if (pulseData && pulseData.createdBy !== auth.currentUser.uid) {
      const requesterName = auth.currentUser.displayName || formatEmailToName(auth.currentUser.email);
      createUserNotification(pulseData.createdBy, {
        title: 'New Pulse Request',
        message: `${requesterName} wants to join your pulse: "${pulseData.text}"`,
        type: 'pulse_request'
      }).catch((e) => console.warn('Notification failed:', e));
    }

    return true;
  } catch (error) {
    console.error('Error requesting to join pulse:', error);
    return false;
  }
};

export const acceptPulseRequest = async (pulseId: string, userId: string) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) return false;
  try {
    const pulseRef = doc(db, 'pulses', pulseId);
    await updateDoc(pulseRef, {
      joinRequests: arrayRemove(userId),
      participants: arrayUnion(userId)
    });

    // Notify the requester
    const pulseSnap = await getDoc(pulseRef);
    const pulseData = pulseSnap.data();
    if (pulseData) {
      await createUserNotification(userId, {
        title: 'Pulse Accepted!',
        message: `Your request to join "${pulseData.text}" was accepted. You can both now go!`,
        type: 'pulse_accepted'
      });
    }

    return true;
  } catch (error) {
    console.error('Error accepting pulse request:', error);
    return false;
  }
};

export const declinePulseRequest = async (pulseId: string, userId: string) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) return false;
  try {
    const pulseRef = doc(db, 'pulses', pulseId);
    await updateDoc(pulseRef, {
      joinRequests: arrayRemove(userId)
    });
    return true;
  } catch (error) {
    console.error('Error declining pulse request:', error);
    return false;
  }
};

// Admin Functions
export const getUpcomingEvents = async (collegeId: string = 'VIT'): Promise<CampusEvent[]> => {
  if (!isFirebaseConfigured) return [];

  const now = Timestamp.now();
  const q = query(
    eventsCollection,
    where('collegeId', '==', collegeId),
    where('endTime', '>=', now),
    orderBy('endTime', 'asc') // Firestore requires index for inequality filter on same field if ordering
    // Ideally order by startTime, but that requires composite index. 
    // For now, simple query, sort client side if needed
  );

  try {
    const snapshot = await getDocs(q);
    const events: CampusEvent[] = [];
    snapshot.forEach(doc => {
      events.push({ id: doc.id, ...(doc.data() as any) } as CampusEvent);
    });
    // Sort by startTime
    return events.sort((a, b) => a.startTime.toMillis() - b.startTime.toMillis());
  } catch (error) {
    console.error('Error fetching events:', error);
    return [];
  }
};

export const markEventInterest = async (eventId: string, status: 'attending' | 'interested' | 'none', isGoingAlone: boolean = false, isPair: boolean = false, linkedWith: string | null = null) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) return;
  const userId = (auth as any).currentUser.uid;

  try {
    // Check if record exists
    const q = query(
      eventAttendeesCollection,
      where('eventId', '==', eventId),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);

    const eventRef = doc(eventsCollection, eventId);

    if (!snapshot.empty) {
      const docId = snapshot.docs[0].id;
      const docRef = doc(eventAttendeesCollection, docId);
      const oldStatus = (snapshot.docs[0].data() as any).status;

      if (status === 'none') {
        await deleteDoc(docRef);
        // Decrement stats
        await updateDoc(eventRef, {
          [`stats.${oldStatus}`]: increment(-1)
        } as any);
      } else {
        await updateDoc(docRef, {
          status,
          isGoingAlone,
          isPair,
          linkedWith,
          updatedAt: serverTimestamp()
        });

        // Update stats if status changed
        if (oldStatus !== status) {
          const batch = writeBatch(db);
          await updateDoc(eventRef, {
            [`stats.${oldStatus}`]: increment(-1),
            [`stats.${status}`]: increment(1)
          } as any);
        }
      }
    } else if (status !== 'none') {
      await addDoc(eventAttendeesCollection, {
        eventId,
        userId,
        status,
        isGoingAlone,
        isPair,
        linkedWith,
        updatedAt: serverTimestamp()
      });
      // Increment stats
      await updateDoc(eventRef, {
        [`stats.${status}`]: increment(1)
      } as any);
    }
  } catch (error) {
    console.error('Error updating event interest:', error);
  }
};

export const getEventAttendees = async (eventId: string): Promise<EventAttendee[]> => {
  if (!isFirebaseConfigured) return [];
  const q = query(
    eventAttendeesCollection,
    where('eventId', '==', eventId)
  );
  try {
    const snapshot = await getDocs(q);
    const attendees: EventAttendee[] = [];
    snapshot.forEach(doc => attendees.push({ id: doc.id, ...(doc.data() as any) } as EventAttendee));
    return attendees;
  } catch (e) {
    console.error('Error fetching event attendees', e);
    return [];
  }
};

// Seed function for testing
export const seedTestEvent = async () => {
  if (!isFirebaseConfigured || !auth.currentUser) return;
  const userId = auth.currentUser.uid;

  // Create a time 2 hours from now
  const start = new Date();
  start.setHours(start.getHours() + 2);
  const end = new Date(start);
  end.setHours(end.getHours() + 2);

  try {
    await addDoc(eventsCollection, {
      title: "Hackathon 2026 Kickoff",
      description: "Join us for the biggest hackathon of the semester! Free food, prizes, and mentorship.",
      clubId: "club_123",
      clubName: "Google Developer Student Club",
      startTime: Timestamp.fromDate(start),
      endTime: Timestamp.fromDate(end),
      location: "SJT 4th Floor",
      collegeId: "VIT",
      registrationLink: "https://vit.ac.in",
      stats: { attending: 12, interested: 45, views: 120 },
      tags: ["Coding", "Hackathon", "Tech"],
      createdBy: userId,
      createdAt: serverTimestamp()
    });
    console.log("Seeded test event");
  } catch (error) {
    console.error('Error seeding test event:', error);
  }
};

export const createEvent = async (eventData: Omit<CampusEvent, 'id' | 'createdAt' | 'stats'>) => {
  if (!isFirebaseConfigured) return null;
  try {
    const profile = auth.currentUser ? await getProfile(auth.currentUser.uid) : null;
    const universityId = eventData.universityId || (profile as any)?.universityId || 'vit-vellore';

    const docRef = await addDoc(eventsCollection, {
      ...eventData,
      tags: eventData.tags || [],
      vibeTags: eventData.vibeTags || [],
      stats: { attending: 0, interested: 0, views: 0 },
      createdBy: auth.currentUser?.uid || 'admin',
      universityId,
      createdAt: serverTimestamp()
    });
    console.log('Event created with ID:', docRef.id);
    return docRef.id;
  } catch (e) {
    console.error('Error creating event:', e);
    throw e;
  }
};

export const createCampusEvent = createEvent;


// Event Chat Functions
export const sendEventMessage = async (eventId: string, content: string, userAvatar?: string) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) return;
  const user = (auth as any).currentUser;
  const userId = user.uid;
  const userName = user.displayName || formatEmailToName(user.email);

  try {
    await addDoc(eventChatsCollection, {
      eventId,
      userId,
      userName,
      userAvatar: userAvatar || user.photoURL || '',
      content,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error('Error sending event message:', error);
  }
};

export const subEventMessages = (eventId: string, callback: (msgs: EventChatMessage[]) => void) => {
  if (!isFirebaseConfigured) return () => { };

  const q = query(
    eventChatsCollection,
    where('eventId', '==', eventId)
  );

  return onSnapshot(q, (snapshot) => {
    const msgs: EventChatMessage[] = [];
    snapshot.forEach(doc => msgs.push({ id: doc.id, ...(doc.data() as any) } as EventChatMessage));
    
    // Sort client-side to avoid index requirement
    msgs.sort((a, b) => {
      const aTime = (a.timestamp as any)?.toMillis?.() || 0;
      const bTime = (b.timestamp as any)?.toMillis?.() || 0;
      return aTime - bTime;
    });
    
    callback(msgs);
  }, (err) => {
    console.error('Error subscribing to event messages:', err);
  });
};

export const getCurrentLocation = (): Promise<{ lat: number; lng: number }> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  });
};

// Timetable Functions
export const saveTimetable = async (timetableData: Record<string, ClassItem[]>) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) {
    console.error('User not authenticated');
    return;
  }

  const userId = auth.currentUser.uid;
  const timetableRef = doc(timetablesCollection, userId);

  try {
    await setDoc(timetableRef, {
      uid: userId,
      timetable: timetableData,
      lastUpdated: serverTimestamp()
    });

    // Instantly update local cache so the user sees changes immediately
    try {
      const cacheKey = `@timetable_cache_${userId}`;
      localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: timetableData }));
    } catch (e) {}

    // Mirror to a public-readable snapshot used by the iOS / Android
    // home-screen widgets (no auth = no token refresh issues for widgets).
    // If the rule doesn't allow the write (e.g. older deployment), silently
    // swallow the error — the main timetable save already succeeded.
    try {
      await setDoc(doc(db, 'publicWidgets', userId), {
        uid: userId,
        timetable: timetableData,
        updatedAt: serverTimestamp(),
      });
    } catch (mirrorErr) {
      console.warn('publicWidgets mirror skipped:', (mirrorErr as Error)?.message);
    }
    console.log('Timetable saved successfully');

    // Sync to native Android home-screen widget (fire-and-forget)
    syncWidgetData(timetableData).catch(() => {});
  } catch (error) {
    console.error('Error saving timetable:', error);
    throw error;
  }
};

export const loadTimetable = async (): Promise<Record<string, ClassItem[]>> => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) {
    console.error('User not authenticated');
    return {};
  }

  const userId = auth.currentUser.uid;
  const cacheKey = `@timetable_cache_${userId}`;
  const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

  // Try to return from cache first
  try {
    const cachedString = localStorage.getItem(cacheKey);
    if (cachedString) {
      const parsed = JSON.parse(cachedString);
      const isExpired = Date.now() - parsed.timestamp > CACHE_EXPIRY_MS;
      
      if (!isExpired) {
        // Fire and forget background sync to ensure it's up to date
        getDoc(doc(timetablesCollection, userId)).then(snap => {
           if (snap.exists()) {
             const data = snap.data() as UserTimetable;
             const freshData = data.timetable || {};
             // Only update cache if different
             if (JSON.stringify(parsed.data) !== JSON.stringify(freshData)) {
               localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: freshData }));
             }
           }
        }).catch(() => {});
        
        return parsed.data;
      }
    }
  } catch (e) {
    console.error('Error reading timetable from cache:', e);
  }

  // If no cache or expired, fetch from Firestore
  try {
    const timetableRef = doc(timetablesCollection, userId);
    const timetableSnapshot = await getDoc(timetableRef);

    if (timetableSnapshot.exists()) {
      const data = timetableSnapshot.data() as UserTimetable;
      const timetableData = data.timetable || {};
      
      // Save to cache
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: timetableData }));
      } catch (e) {}

      return timetableData;
    } else {
      return {};
    }
  } catch (error) {
    console.error('Error loading timetable:', error);
    return {};
  }
};

// Friend Timetable Functions
export const getFriendTimetable = async (friendUserId: string): Promise<Record<string, ClassItem[]>> => {
  if (!isFirebaseConfigured) return {};

  const cacheKey = `@friend_timetable_cache_${friendUserId}`;
  const CACHE_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours for friends

  try {
    const cachedString = localStorage.getItem(cacheKey);
    if (cachedString) {
      const parsed = JSON.parse(cachedString);
      const isExpired = Date.now() - parsed.timestamp > CACHE_EXPIRY_MS;
      if (!isExpired) return parsed.data;
    }
  } catch (e) {}

  try {
    const timetableRef = doc(timetablesCollection, friendUserId);
    const timetableSnapshot = await getDoc(timetableRef);

    if (timetableSnapshot.exists()) {
      const data = timetableSnapshot.data() as UserTimetable;
      const timetableData = data.timetable || {};
      
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: timetableData }));
      } catch (e) {}

      return timetableData;
    } else {
      return {};
    }
  } catch (error) {
    console.error('Error loading friend timetable:', error);
    return {};
  }
};

// Enhanced Friend Profile Data
export interface EnhancedFriendProfile extends UserProfile {
  timetable?: Array<{ day: string; time: string; title: string; where?: string }>;
  sharedCourses?: string[];
  mutualFriends?: number;
}

export const getEnhancedFriendProfile = async (friendUserId: string): Promise<EnhancedFriendProfile | null> => {
  if (!isFirebaseConfigured) return null;
  try {
    // Get basic profile
    const profile = await getUserProfile(friendUserId);
    if (!profile) return null;

    // Get timetable
    const timetableData = await getFriendTimetable(friendUserId);

    // Convert timetable format for UI
    const timetableArray: Array<{ day: string; time: string; title: string; where?: string }> = [];
    Object.entries(timetableData).forEach(([day, classes]) => {
      classes.forEach((classItem) => {
        timetableArray.push({
          day: day,
          time: classItem.time,
          title: classItem.title || classItem.course,
          where: classItem.location || classItem.academicBlock
        });
      });
    });

    // TODO: Calculate shared courses and mutual friends
    const sharedCourses: string[] = [];
    const mutualFriends = 0;

    return {
      ...profile,
      timetable: timetableArray,
      sharedCourses,
      mutualFriends
    };
  } catch (error) {
    console.error('Error getting enhanced friend profile:', error);
    return null;
  }
};

// Status update functions
export const updateUserStatus = async (status: 'in class' | 'in library' | 'in ground' | 'in hostel' | 'available') => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) {
    console.error('User not authenticated');
    throw new Error('User not authenticated');
  }

  const userId = (auth as any).currentUser.uid;
  const userRef = doc(usersCollection, userId);

  try {
    await updateDoc(userRef, {
      status,
      lastActive: serverTimestamp()
    });
    console.log('User status updated successfully');
  } catch (error: any) {
    console.error('Error updating user status:', error);

    // If document doesn't exist, create it with setDoc and merge
    if (error.code === 'not-found') {
      console.log('User document not found, creating with setDoc...');
      try {
        await setDoc(userRef, {
          uid: userId,
          email: auth.currentUser.email,
          displayName: auth.currentUser.displayName || formatEmailToName(auth.currentUser.email),
          status,
          lastActive: serverTimestamp(),
          createdAt: serverTimestamp()
        }, { merge: true });
        console.log('User document created and status updated successfully');
      } catch (createError) {
        console.error('Error creating user document:', createError);
        throw createError;
      }
    } else {
      throw error;
    }
  }
};

export const getUserStatus = async (userId?: string): Promise<string | null> => {
  const targetUserId = userId || (isFirebaseConfigured ? (auth as any)?.currentUser?.uid : undefined);

  if (!targetUserId) {
    return null;
  }

  const userRef = doc(usersCollection, targetUserId);

  try {
    const userSnapshot = await getDoc(userRef);

    if (userSnapshot.exists()) {
      const userData = userSnapshot.data() as UserProfile;
      return userData.status || 'available';
    } else {
      console.log('User not found');
      return null;
    }
  } catch (error) {
    console.error('Error getting user status:', error);
    return null;
  }
};

// Get discoverable users (all users except current user and existing friends)
export const getDiscoverableUsers = async (universityId?: string): Promise<UserProfile[]> => {
  if (!isFirebaseConfigured) return [];
  try {
    console.log('🔍 getDiscoverableUsers: Starting...');
    if (!(auth as any)?.currentUser) {
      console.log('❌ getDiscoverableUsers: No current user');
      return [];
    }

    const currentUserId = (auth as any).currentUser.uid;
    console.log('👤 getDiscoverableUsers: Current user ID:', currentUserId);

    // Get limited users to avoid fetching the entire collection
    console.log('📊 getDiscoverableUsers: Fetching users limit(50)...');
    let q = query(usersCollection, limit(50));
    if (universityId) {
      q = query(usersCollection, where('universityId', '==', universityId), limit(50));
    }
    const usersSnapshot = await getDocs(q);
    console.log('📊 getDiscoverableUsers: Total documents in users collection:', usersSnapshot.size);

    const allUsers: UserProfile[] = [];

    usersSnapshot.forEach((doc) => {
      const userData = doc.data() as UserProfile;
      console.log('👥 getDiscoverableUsers: Found user:', userData.uid, userData.displayName);
      // Exclude current user
      if (userData.uid !== currentUserId) {
        allUsers.push(userData);
      } else {
        console.log('🚫 getDiscoverableUsers: Excluding current user:', userData.uid);
      }
    });

    console.log('👥 getDiscoverableUsers: All users (excluding current):', allUsers.length);

    // Get existing friends to exclude them
    const friendIds = new Set<string>();

    // Get friend requests where current user is sender
    console.log('🤝 getDiscoverableUsers: Checking sent friend requests...');
    const sentRequestsQuery = query(
      friendRequestsCollection,
      where('senderId', '==', currentUserId),
      where('status', '==', 'accepted')
    );
    const sentRequestsSnapshot = await getDocs(sentRequestsQuery);
    console.log('📤 getDiscoverableUsers: Sent friend requests:', sentRequestsSnapshot.size);
    sentRequestsSnapshot.forEach((doc) => {
      const data: any = doc.data() as any;
      friendIds.add(data.receiverId);
      console.log('🤝 getDiscoverableUsers: Friend (sent request):', data.receiverId);
    });

    // Get friend requests where current user is receiver
    console.log('🤝 getDiscoverableUsers: Checking received friend requests...');
    const receivedRequestsQuery = query(
      friendRequestsCollection,
      where('receiverId', '==', currentUserId),
      where('status', '==', 'accepted')
    );
    const receivedRequestsSnapshot = await getDocs(receivedRequestsQuery);
    console.log('📥 getDiscoverableUsers: Received friend requests:', receivedRequestsSnapshot.size);
    receivedRequestsSnapshot.forEach((doc) => {
      const data: any = doc.data() as any;
      friendIds.add(data.senderId);
      console.log('🤝 getDiscoverableUsers: Friend (received request):', data.senderId);
    });

    console.log('🤝 getDiscoverableUsers: Total friends to exclude:', friendIds.size);

    // Filter out existing friends
    const discoverableUsers = allUsers.filter(user => !friendIds.has(user.uid));
    console.log('✅ getDiscoverableUsers: Final discoverable users:', discoverableUsers.length);

    return discoverableUsers;
  } catch (error) {
    console.error('❌ getDiscoverableUsers: Error:', error);
    return [];
  }
};

// Study Groups types and helpers
export interface StudyGroup {
  id?: string;
  name: string;
  course?: string;
  description?: string;
  createdBy: string;
  createdAt: Timestamp;
  members: string[];
  joinRequests?: string[];
  maxMembers?: number;
  meetingTime?: string;
  universityId: string;
}

const studyGroupsCollection = isFirebaseConfigured ? collection(db, 'studyGroups') : (undefined as any);

export const createStudyGroup = async (data: {
  name: string;
  course?: string;
  description?: string;
  maxMembers?: number;
  meetingTime?: string;
  universityId: string;
}) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) return null;
  try {
    const docRef = await addDoc(studyGroupsCollection, {
      name: data.name,
      course: data.course || null,
      description: data.description || null,
      createdBy: (auth as any).currentUser.uid,
      createdAt: serverTimestamp(),
      members: [(auth as any).currentUser.uid],
      joinRequests: [],
      maxMembers: data.maxMembers || null,
      meetingTime: data.meetingTime || null,
      universityId: data.universityId,
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating study group:', error);
    return null;
  }
};

export const getStudyGroups = (callback: (groups: StudyGroup[]) => void, universityId?: string) => {
  // Guard subscription behind authentication to align with Firestore rules
  if (!auth.currentUser) {
    callback([]);
    return () => { };
  }

  let q = query(studyGroupsCollection);
  if (universityId) {
    q = query(studyGroupsCollection, where('universityId', '==', universityId));
  }

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const groups: StudyGroup[] = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      // Sort client-side by createdAt descending or ascending to avoid composite index requirements
      groups.sort((a, b) => {
        const aTime = a.createdAt ? (a.createdAt.seconds || (typeof a.createdAt.toMillis === 'function' ? a.createdAt.toMillis() / 1000 : new Date(a.createdAt as any).getTime() / 1000)) : (Date.now() / 1000);
        const bTime = b.createdAt ? (b.createdAt.seconds || (typeof b.createdAt.toMillis === 'function' ? b.createdAt.toMillis() / 1000 : new Date(b.createdAt as any).getTime() / 1000)) : (Date.now() / 1000);
        return aTime - bTime;
      });
      callback(groups);
    },
    (error) => {
      console.error('Error subscribing to study groups:', error);
      callback([]);
    }
  );
  return unsubscribe;
};

export const getMyStudyGroups = (callback: (groups: StudyGroup[]) => void, universityId?: string) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) { callback([]); return () => { }; }
  
  // Query only by members array-contains (which uses automatically generated single-field index)
  // to avoid requiring composite indexes with universityId.
  const q = query(studyGroupsCollection, where('members', 'array-contains', (auth as any).currentUser.uid));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    let groups: StudyGroup[] = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    if (universityId) {
      groups = groups.filter(g => g.universityId === universityId);
    }
    // Sort client-side by createdAt
    groups.sort((a, b) => {
      const aTime = a.createdAt ? (a.createdAt.seconds || (typeof a.createdAt.toMillis === 'function' ? a.createdAt.toMillis() / 1000 : new Date(a.createdAt as any).getTime() / 1000)) : (Date.now() / 1000);
      const bTime = b.createdAt ? (b.createdAt.seconds || (typeof b.createdAt.toMillis === 'function' ? b.createdAt.toMillis() / 1000 : new Date(b.createdAt as any).getTime() / 1000)) : (Date.now() / 1000);
      return aTime - bTime;
    });
    callback(groups);
  }, (error) => {
    console.error('Error subscribing to my study groups:', error);
    callback([]);
  });
  return unsubscribe;
};

export const joinStudyGroup = async (groupId: string) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) return false;
  try {
    const ref = doc(studyGroupsCollection, groupId);
    await updateDoc(ref, { members: arrayUnion(auth.currentUser.uid) });
    return true;
  } catch (error) {
    console.error('Error joining study group:', error);
    return false;
  }
};

export const leaveStudyGroup = async (groupId: string) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) return false;
  try {
    const ref = doc(studyGroupsCollection, groupId);
    await updateDoc(ref, { members: arrayRemove(auth.currentUser.uid) });
    return true;
  } catch (error) {
    console.error('Error leaving study group:', error);
    return false;
  }
};

export const requestJoinStudyGroup = async (groupId: string) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) return false;
  try {
    const ref = doc(studyGroupsCollection, groupId);
    const groupSnap = await getDoc(ref);
    const groupData = groupSnap.data() as StudyGroup | undefined;
    await updateDoc(ref, { joinRequests: arrayUnion(auth.currentUser.uid) });

    const ownerId = groupData?.createdBy;
    if (ownerId && ownerId !== auth.currentUser.uid) {
      const requesterName = auth.currentUser.displayName || formatEmailToName(auth.currentUser.email);
      createUserNotification(ownerId, {
        title: 'New Study Group Request',
        message: `${requesterName} requested to join "${groupData?.name || 'your study group'}"`,
        type: 'study_group_request'
      });
    }
    return true;
  } catch (error) {
    console.error('Error requesting to join study group:', error);
    return false;
  }
};

export const approveJoinRequest = async (groupId: string, userId: string) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) return false;
  try {
    const ref = doc(studyGroupsCollection, groupId);
    await updateDoc(ref, { 
      members: arrayUnion(userId),
      joinRequests: arrayRemove(userId)
    });
    return true;
  } catch (error) {
    console.error('Error approving join request:', error);
    return false;
  }
};

export const rejectJoinRequest = async (groupId: string, userId: string) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) return false;
  try {
    const ref = doc(studyGroupsCollection, groupId);
    await updateDoc(ref, { joinRequests: arrayRemove(userId) });
    return true;
  } catch (error) {
    console.error('Error rejecting join request:', error);
    return false;
  }
};

// Invite one or more friends to a study group (owner-only per rules)
export const inviteMembersToStudyGroup = async (groupId: string, friendUids: string[]) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser || !groupId || !Array.isArray(friendUids) || friendUids.length === 0) return false;
  try {
    const ref = doc(studyGroupsCollection, groupId);
    const groupSnap = await getDoc(ref);
    const groupData = groupSnap.data() as StudyGroup | undefined;
    await updateDoc(ref, { members: arrayUnion(...friendUids) });

    const inviterName = auth.currentUser.displayName || formatEmailToName(auth.currentUser.email);
    friendUids.forEach((friendId) => {
      if (friendId !== auth.currentUser?.uid) {
        createUserNotification(friendId, {
          title: 'Added To Study Group',
          message: `${inviterName} added you to "${groupData?.name || 'a study group'}"`,
          type: 'study_group_request'
        });
      }
    });
    return true;
  } catch (error) {
    console.error('Error inviting members to study group:', error);
    return false;
  }
};

// Delete a study group (owner-only per rules)
export const deleteStudyGroup = async (groupId: string): Promise<boolean> => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser || !groupId) return false;
  try {
    const ref = doc(studyGroupsCollection, groupId);
    await deleteDoc(ref);
    return true;
  } catch (error) {
    console.error('Error deleting study group:', error);
    return false;
  }
};

// --- Study Group Chat ---
export type StudyMessageType = 'text' | 'meet_link' | 'focus_session' | 'system';

export interface StudyGroupMessage {
  id?: string;
  senderId: string;
  content: string;
  timestamp: Timestamp;
  type?: StudyMessageType;
  metadata?: any;
  isPinned?: boolean;
  reactions?: Record<string, string>; // userId -> emoji
}

export interface StudyGroupResource {
  id?: string;
  groupId: string;
  title: string;
  type: 'note' | 'link' | 'paper' | 'other';
  url: string;
  addedBy: string;
  createdAt: Timestamp;
  isImportant?: boolean;
}

export const sendGroupMessage = async (
  groupId: string, 
  content: string,
  type: StudyMessageType = 'text',
  metadata?: any
) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) return null;
  try {
    const messagesRef = collection(db, 'studyGroups', groupId, 'messages');
    const docRef = await addDoc(messagesRef, {
      senderId: (auth as any).currentUser.uid,
      content,
      type,
      ...(metadata ? { metadata } : {}),
      timestamp: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error sending group message:', error);
    return null;
  }
};

export const getGroupMessages = (groupId: string, callback: (messages: StudyGroupMessage[]) => void) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) {
    callback([]);
    return () => { };
  }

  const messagesRef = collection(db, 'studyGroups', groupId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'asc'));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as StudyGroupMessage[];
    callback(messages);
  }, (error) => {
    console.error('Error getting group messages:', error);
    callback([]);
  });

  return unsubscribe;
};

// --- Study Group Features ---

export const toggleMessagePin = async (groupId: string, messageId: string, isPinned: boolean) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) return false;
  try {
    const ref = doc(db, 'studyGroups', groupId, 'messages', messageId);
    await updateDoc(ref, { isPinned });
    return true;
  } catch (e) {
    console.error('Error toggling pin:', e);
    return false;
  }
};

export const toggleMessageReaction = async (groupId: string, messageId: string, emoji: string | null) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) return false;
  try {
    const userId = (auth as any).currentUser.uid;
    const ref = doc(db, 'studyGroups', groupId, 'messages', messageId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    
    const reactions = snap.data().reactions || {};
    if (emoji) {
      reactions[userId] = emoji;
    } else {
      delete reactions[userId];
    }
    
    await updateDoc(ref, { reactions });
    return true;
  } catch (e) {
    console.error('Error reacting:', e);
    return false;
  }
};

export const getStudyResources = (groupId: string, callback: (resources: StudyGroupResource[]) => void) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) {
    callback([]);
    return () => {};
  }
  const resourcesRef = collection(db, 'studyGroups', groupId, 'resources');
  const q = query(resourcesRef, orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const resources = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudyGroupResource));
    callback(resources);
  }, (err) => console.error('Error getting resources:', err));
};

// --- Group Todo List ---
export interface StudyGroupTodo {
  id?: string;
  text: string;
  createdBy: string;
  completed: boolean;
  completedBy?: string;
  completedByUsers?: string[];
  createdAt: any;
}

export const getGroupTodos = (groupId: string, callback: (todos: StudyGroupTodo[]) => void) => {
  if (!isFirebaseConfigured) return () => {};
  const todosRef = collection(db, 'studyGroups', groupId, 'todos');
  const q = query(todosRef, orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudyGroupTodo)));
  });
};

export const addGroupTodo = async (groupId: string, text: string) => {
  if (!isFirebaseConfigured || !auth.currentUser) return null;
  const todosRef = collection(db, 'studyGroups', groupId, 'todos');
  return addDoc(todosRef, {
    text,
    completed: false,
    completedBy: null,
    completedByUsers: [],
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser.uid
  });
};

export const toggleGroupTodo = async (groupId: string, todoId: string, completed: boolean) => {
  if (!isFirebaseConfigured || !auth.currentUser) return;
  const todoRef = doc(db, 'studyGroups', groupId, 'todos', todoId);
  return updateDoc(todoRef, {
    completed,
    completedBy: completed ? auth.currentUser.uid : null,
    completedByUsers: completed
      ? arrayUnion(auth.currentUser.uid)
      : arrayRemove(auth.currentUser.uid)
  });
};

export const deleteGroupTodo = async (groupId: string, todoId: string) => {
  if (!isFirebaseConfigured) return;
  const todoRef = doc(db, 'studyGroups', groupId, 'todos', todoId);
  return deleteDoc(todoRef);
};

export const addStudyResourceLink = async (groupId: string, title: string, url: string, type: 'link' | 'note' | 'paper' | 'other') => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) return null;
  try {
    const resourcesRef = collection(db, 'studyGroups', groupId, 'resources');
    const docRef = await addDoc(resourcesRef, {
      groupId,
      title,
      type,
      url,
      addedBy: (auth as any).currentUser.uid,
      createdAt: serverTimestamp(),
      isImportant: false,
    });
    // System message
    await sendGroupMessage(groupId, `New resource added: ${title}`, 'system');
    return docRef.id;
  } catch (e) {
    console.error('Error adding resource link:', e);
    return null;
  }
};

export const uploadStudyResourceFile = async (groupId: string, file: File, title: string, type: 'note' | 'paper' | 'other') => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser || !storage) return null;
  try {
    const fileRef = ref(storage, `studyGroups/${groupId}/resources/${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    return await addStudyResourceLink(groupId, title, url, type);
  } catch (e) {
    console.error('Error uploading resource file:', e);
    return null;
  }
};

export const toggleResourceImportant = async (groupId: string, resourceId: string, isImportant: boolean) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) return false;
  try {
    const resourceRef = doc(db, 'studyGroups', groupId, 'resources', resourceId);
    await updateDoc(resourceRef, { isImportant });
    return true;
  } catch (e) {
    console.error('Error toggling important:', e);
    return false;
  }
};

export const deleteStudyResource = async (groupId: string, resourceId: string) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) return false;
  try {
    const resourceRef = doc(db, 'studyGroups', groupId, 'resources', resourceId);
    await deleteDoc(resourceRef);
    return true;
  } catch (e) {
    console.error('Error deleting resource:', e);
    return false;
  }
};

// E2EE Key Management
export const uploadUserPublicKey = async (publicKeyJWK: JsonWebKey) => {
  if (!isFirebaseConfigured || !(auth as any).currentUser) return;
  const uid = (auth as any).currentUser.uid;
  try {
    const userRef = doc(usersCollection, uid);
    await updateDoc(userRef, {
      publicKey: JSON.stringify(publicKeyJWK),
      updatedAt: serverTimestamp()
    });
    console.log("Public Key uploaded to Firestore");
  } catch (error) {
    console.error("Error uploading public key", error);
  }
};

export const getUserPublicKey = async (userId: string): Promise<JsonWebKey | null> => {
  if (!isFirebaseConfigured) return null;
  try {
    const userRef = doc(usersCollection, userId);
    const snap = await getDoc(userRef);
    if (snap.exists() && snap.data().publicKey) {
      return JSON.parse(snap.data().publicKey);
    }
    return null;
  } catch (error) {
    console.warn(`Could not fetch public key for user ${userId}`, error);
    return null;
  }
};
// ------ CONNECT FEATURES HELPER FUNCTIONS ------

// 1. Pulses
export const createPulse = async (
  text: string,
  durationMinutes: number,
  metadata?: { vibe?: string; crowdMin?: number; crowdMax?: number; isPublic?: boolean; location?: string },
) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) {
    console.error('createPulse: Firebase not configured or user not signed in');
    throw new Error('Not authenticated');
  }
  const userId = (auth as any).currentUser.uid;
  const expiresAt = new Date(Date.now() + durationMinutes * 60000);

  // Read from BOTH collections — users (admin-managed) is the source of truth
  const [userDoc, profileDoc] = await Promise.all([
    getUserProfile(userId).catch(() => null),
    getProfile(userId).catch(() => null),
  ]);
  const rawUniId =
    (userDoc as any)?.universityId ||
    (profileDoc as any)?.universityId ||
    (userDoc as any)?.university ||
    (profileDoc as any)?.university ||
    'vit-vellore';
  // Normalize: if the value is a display name like "VIT Vellore" convert it
  // to a system ID like "vit-vellore" via the registry lookup.
  const { getUniversityConfig: getUniCfg } = await import('../../config/universities');
  const universityId = getUniCfg(rawUniId).id;

  const pulseData = {
    text,
    createdBy: userId,
    universityId,
    location: metadata?.location || null,
    vibe: metadata?.vibe || null,
    crowdMin: typeof metadata?.crowdMin === 'number' ? metadata.crowdMin : null,
    crowdMax: typeof metadata?.crowdMax === 'number' ? metadata.crowdMax : null,
    isPublic: typeof metadata?.isPublic === 'boolean' ? metadata.isPublic : true,
    durationMinutes,
    expiresAt: Timestamp.fromDate(expiresAt),
    createdAt: Timestamp.now(),
    joinRequests: [],
    participants: [userId],
  };

  console.log('Creating pulse with data:', pulseData);

  // Generate a document reference with an auto-ID upfront so we can use setDoc
  const newDocRef = doc(collection(db, 'pulses'));
  const docId = newDocRef.id;

  // Race the Firestore write against a timeout so the UI never hangs.
  // On Capacitor/Android WebViews, addDoc/setDoc can stall waiting for
  // server acknowledgment even though the write succeeds locally.
  const writePromise = setDoc(newDocRef, pulseData).then(() => docId);
  const timeoutPromise = new Promise<string>((resolve) => {
    setTimeout(() => {
      console.warn('createPulse: Server ACK timed out, but write was queued locally. Treating as success.');
      resolve(docId);
    }, 5000);
  });

  try {
    const resultId = await Promise.race([writePromise, timeoutPromise]);
    console.log('Pulse created successfully with ID:', resultId);
    return resultId;
  } catch (error: any) {
    console.error('Error creating pulse:', error?.message || error);
    throw error;
  }
};

export const getPulses = (callback: (pulses: Pulse[]) => void, universityId?: string) => {
  if (!isFirebaseConfigured) return () => {};

  let unsubSnapshot: (() => void) | null = null;

  const unsubAuth = onAuthStateChanged(auth, (user) => {
    if (unsubSnapshot) {
      unsubSnapshot();
      unsubSnapshot = null;
    }

    if (user) {
      // High-performance real-time listener without complex composite indexes
      // We fetch the most recent pulses globally to avoid composite index requirements
      const q = query(
        collection(db, 'pulses'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );

      unsubSnapshot = onSnapshot(q, async (snapshot) => {
        try {
          const userRef = doc(db, 'profiles', user.uid);
          const userSnap = await getDoc(userRef);
          const blockedUsers = userSnap.data()?.privacySettings?.blockedUsers || [];

          const now = Date.now();
          const pulses: Pulse[] = [];
          
          snapshot.forEach(doc => {
            const data = doc.data() as any;
            if (data.createdBy && blockedUsers.includes(data.createdBy)) return; // Filter blocked users
            
            // Safely check expiry
            let expirationTime = 0;
            if (data.expiresAt) {
            if (typeof data.expiresAt.toMillis === 'function') {
              expirationTime = data.expiresAt.toMillis();
            } else if (data.expiresAt.seconds) {
              expirationTime = data.expiresAt.seconds * 1000;
            }
          }
          
          if (expirationTime > now) {
            // Client-side university filter with robust normalization
            const rawUniId = data.universityId || data.university || '';
            const normalizedDataUniId = getUniversityConfig(rawUniId).id;
            
            if (!universityId || normalizedDataUniId === universityId || rawUniId === universityId) {
               pulses.push({ id: doc.id, ...data } as Pulse);
            }
          }
        });
        
        // Sort by creation time descending for feed
        pulses.sort((a, b) => {
          const tA = a.createdAt && typeof a.createdAt.toMillis === 'function' ? a.createdAt.toMillis() : 0;
          const tB = b.createdAt && typeof b.createdAt.toMillis === 'function' ? b.createdAt.toMillis() : 0;
          return tB - tA;
        });
        
        callback(pulses);
        } catch (error) {
          console.error("Error inside getPulsesRealtime snapshot:", error);
        }
      }, error => {
        console.error('Error listening to pulses:', error);
        callback([]);
      });
    } else {
      callback([]);
    }
  });

  return () => {
    unsubAuth();
    if (unsubSnapshot) unsubSnapshot();
  };
};

// 2. Private Interest
export const markPrivateInterest = async (eventId: string, interested: boolean) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) return;
  const userId = (auth as any).currentUser.uid;
  
  const interestRef = doc(db, `eventInterest/${eventId}/interested/${userId}`);
  
  try {
    if (interested) {
      await setDoc(interestRef, { timestamp: serverTimestamp() });
    } else {
      await deleteDoc(interestRef);
    }
  } catch (error) {
    console.error('Error marking private interest:', error);
  }
};

export const getPrivateInterestCount = (eventId: string, callback: (count: number) => void) => {
  if (!isFirebaseConfigured) return () => {};
  
  const q = collection(db, `eventInterest/${eventId}/interested`);
  
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.size);
  }, error => {
    console.error('Error in private interest count:', error);
    callback(0);
  });
};

// 4. Study SOS
export const createSOSAlert = async (course: string, topic: string) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) return;
  const userId = (auth as any).currentUser.uid;
  const expiresAt = new Date(Date.now() + 2 * 60 * 60000); // 2 hours
  
  try {
    const profile = await getProfile(userId);
    const universityId = (profile as any)?.universityId || 'vit-vellore';

    const sosRef = doc(db, 'sos', userId);
    await setDoc(sosRef, {
      course,
      topic,
      createdBy: userId,
      universityId,
      expiresAt: Timestamp.fromDate(expiresAt),
      createdAt: serverTimestamp()
    });

    // Notify friends
    try {
      const q1 = query(
        collection(db, 'friendRequests'),
        where('senderId', '==', userId),
        where('status', '==', 'accepted')
      );
      const q2 = query(
        collection(db, 'friendRequests'),
        where('receiverId', '==', userId),
        where('status', '==', 'accepted')
      );
      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      
      const friendIds = new Set<string>();
      snap1.forEach(doc => friendIds.add((doc.data() as any).receiverId));
      snap2.forEach(doc => friendIds.add((doc.data() as any).senderId));

      const userName = (profile as any)?.name || (profile as any)?.displayName || 'A friend';

      const notificationPromises = Array.from(friendIds).map(friendId => 
        createUserNotification(friendId, {
          title: '🚨 Study SOS Alert',
          message: `${userName} needs urgent help with ${course}: ${topic}`,
          type: 'sos_alert'
        })
      );
      
      await Promise.all(notificationPromises);
    } catch (notifErr) {
      console.error('Error notifying friends for SOS:', notifErr);
    }

  } catch (error) {
    console.error('Error creating SOS alert:', error);
  }
};

export const getSOSAlerts = (callback: (alerts: SOSAlert[]) => void, universityId?: string) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) return () => {};
  
  const constraints: any[] = [
    where('expiresAt', '>', Timestamp.now()),
    orderBy('expiresAt', 'asc'),
    limit(20)
  ];

  if (universityId) {
    constraints.unshift(where('universityId', '==', universityId));
  }

  // High-performance real-time listener with limit and inequality filter
  const q = query(
    collection(db, 'sos'),
    ...constraints
  );

  return onSnapshot(q, (snapshot) => {
    const alerts: SOSAlert[] = [];
    snapshot.forEach(doc => {
      const data = doc.data() as any;
      
      // Client-side fallback filter
      if (universityId) {
        const docUniId = data.universityId;
        if (docUniId && docUniId !== universityId) return;
        if (!docUniId && data.university && getUniversityConfig(data.university).id !== universityId) return;
      }
      
      alerts.push({ id: doc.id, ...data } as SOSAlert);
    });
    
    // Sort by createdAt descending client-side
    alerts.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    callback(alerts);
  }, error => {
    console.error('Error listening to SOS alerts:', error);
    callback([]);
  });
};

// 5. Canteen/Location Check-In
export const createCheckIn = async (location: string, note?: string) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) return;
  const userId = (auth as any).currentUser.uid;
  const expiresAt = new Date(Date.now() + 60 * 60000); // 1 hour
  
  try {
    const profile = await getProfile(userId);
    const universityId = (profile as any)?.universityId || 'vit-vellore';

    const checkinRef = doc(db, 'checkins', userId);
    await setDoc(checkinRef, {
      location,
      note: note || null,
      createdBy: userId,
      universityId,
      expiresAt: Timestamp.fromDate(expiresAt),
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error creating checkin:', error);
  }
};

export const getCheckIns = (callback: (checkins: CheckIn[]) => void, universityId?: string) => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) return () => {};
  
  const constraints: any[] = [
    where('expiresAt', '>', Timestamp.now()),
    orderBy('expiresAt', 'asc'),
    limit(20)
  ];
  
  if (universityId) {
    constraints.unshift(where('universityId', '==', universityId));
  }

  // High-performance real-time listener with limit and inequality filter
  const q = query(
    collection(db, 'checkins'),
    ...constraints
  );

  return onSnapshot(q, async (snapshot) => {
    const rawCheckins: CheckIn[] = [];
    snapshot.forEach(doc => rawCheckins.push({ id: doc.id, ...(doc.data() as any) } as CheckIn));
    
    // Filter by privacy settings
    const checkins: CheckIn[] = [];
    for (const c of rawCheckins) {
      if (c.createdBy === auth.currentUser?.uid) {
         checkins.push(c);
         continue;
      }
      try {
        const p = await getProfile(c.createdBy);
        const isGhost = p?.privacySettings?.ghostMode === true;
        const locationVisible = p?.privacySettings?.locationVisible !== false;
        if (!isGhost && locationVisible) {
          checkins.push(c);
        }
      } catch (e) {
        checkins.push(c); // fallback
      }
    }

    // Sort by createdAt descending client-side
    checkins.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    callback(checkins);
  }, error => {
    console.error('Error listening to CheckIns:', error);
    callback([]);
  });
};

// ------ ADMIN & DASHBOARD FUNCTIONS ------

// 1. Admin Auth & RBAC
export const getAdminUser = async (uid: string): Promise<AdminUser | null> => {
  if (!isFirebaseConfigured || !uid) return null;
  try {
    const adminRef = doc(adminUsersCollection, uid);
    const snap = await getDoc(adminRef);
    if (snap.exists()) return snap.data() as AdminUser;
    return null;
  } catch (e) {
    console.error('Error getting admin user:', e);
    return null;
  }
};

// 2. Event Management (Enhanced)
export const updateEventMetadata = async (eventId: string, metadata: Partial<CampusEvent>) => {
  if (!isFirebaseConfigured || !eventId) return;
  const eventRef = doc(eventsCollection, eventId);
  await updateDoc(eventRef, { ...metadata, updatedAt: serverTimestamp() });
};

export const deleteEvent = async (eventId: string) => {
  if (!isFirebaseConfigured || !eventId) return;
  await deleteDoc(doc(eventsCollection, eventId));
};

// 2. Event Management

export const getUpcomingEventsRealtime = (callback: (events: CampusEvent[]) => void, universityId?: string) => {
  if (!isFirebaseConfigured) return () => {};
  
  const constraints: any[] = [];
  if (universityId) {
    constraints.push(where('universityId', '==', universityId));
  }
  constraints.push(limit(150));

  // Increase limit to ensure newly created events are fetched even if legacy data clogs the default order
  const q = query(
    eventsCollection,
    ...constraints
  );

  return onSnapshot(q, (snapshot) => {
    const events: CampusEvent[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as any;
      // More permissive filter: only skip if it's explicitly identified as a brand ad
      if (!data.brandName && !data.ctaLink) {
        events.push({ id: doc.id, ...data } as CampusEvent);
      }
    });
    
    // Primary sort: Most recently created first (newly created events at top)
    // Secondary sort: By start time
    events.sort((a, b) => {
      const aCreated = (a.createdAt as any)?.toMillis?.() || 0;
      const bCreated = (b.createdAt as any)?.toMillis?.() || 0;
      if (bCreated !== aCreated) return bCreated - aCreated;
      
      const aStart = (a.startTime as any)?.toMillis?.() || 0;
      const bStart = (b.startTime as any)?.toMillis?.() || 0;
      return aStart - bStart;
    });

    callback(events);
  }, (error: Error) => {
    console.error('Firestore Events Listener Error:', error);
    callback([]);
  });
};

// 3. Advertisement Management
export const createAdvertisement = async (adData: Omit<Advertisement, 'id' | 'createdAt' | 'stats'>) => {
  if (!isFirebaseConfigured) return null;
  try {
    const docRef = await addDoc(adsCollection, {
      ...adData,
      stats: { impressions: 0, clicks: 0 },
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (e) {
    console.error('Error creating ad:', e);
    throw e;
  }
};

export const updateAdvertisement = async (adId: string, adData: Partial<Advertisement>) => {
  if (!isFirebaseConfigured || !adId) return;
  await updateDoc(doc(adsCollection, adId), { ...adData, updatedAt: serverTimestamp() });
};

export const deleteAdvertisement = async (adId: string) => {
  if (!isFirebaseConfigured || !adId) return;
  await deleteDoc(doc(adsCollection, adId));
};

export const getActiveAds = (callback: (ads: Advertisement[]) => void) => {
  if (!isFirebaseConfigured) return () => {};
  const now = Timestamp.now();
  const q = query(
    adsCollection,
    where('status', '==', 'active'),
    where('endDate', '>=', now)
  );
  return onSnapshot(q, (snapshot) => {
    const ads: Advertisement[] = [];
    snapshot.forEach(doc => ads.push({ id: doc.id, ...(doc.data() as any) } as Advertisement));
    callback(ads);
  });
};

export const getAllAds = async (): Promise<Advertisement[]> => {
  if (!isFirebaseConfigured) return [];
  const snapshot = await getDocs(adsCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Advertisement));
};

export const getAllAdsRealtime = (callback: (ads: Advertisement[]) => void) => {
  if (!isFirebaseConfigured) return () => {};
  
  // Use direct collection listener to ensure legacy ads (missing createdAt) are fetched
  return onSnapshot(adsCollection, (snapshot: QuerySnapshot<DocumentData>) => {
    const ads: Advertisement[] = [];
    snapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      const data = doc.data();
      // Ensure we only include actual ads (filter out events that might have been accidentally saved here)
      if (data.brandName !== undefined || data.ctaLink !== undefined) {
        ads.push({ id: doc.id, ...data } as Advertisement);
      }
    });
    
    // Sort client-side
    ads.sort((a, b) => {
      const aTime = (a.createdAt as any)?.toMillis?.() || 0;
      const bTime = (b.createdAt as any)?.toMillis?.() || 0;
      return bTime - aTime;
    });

    console.log(`Fetched ${ads.length} ads in real-time`);
    callback(ads);
  }, (error: Error) => {
    console.error('Firestore Ads Listener Error:', error);
    callback([]);
  });
};

// 4. Notification Management
export const createAdminNotification = async (notifData: Omit<AdminNotification, 'id' | 'createdAt'>) => {
  if (!isFirebaseConfigured) return null;
  try {
    const docRef = await addDoc(adminNotificationsCollection, {
      ...notifData,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (e) {
    console.error('Error creating notification:', e);
    return null;
  }
};

export const getAllNotifications = async (): Promise<AdminNotification[]> => {
  if (!isFirebaseConfigured) return [];
  const snapshot = await getDocs(query(adminNotificationsCollection, orderBy('createdAt', 'desc')));
  return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as AdminNotification));
};

export const getAllNotificationsRealtime = (callback: (notifications: AdminNotification[]) => void) => {
  if (!isFirebaseConfigured) return () => {};
  
  let unsubscribeSnapshot: (() => void) | null = null;
  
  const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    // Only attempt to listen if the user is authenticated, to satisfy firestore.rules (isSignedIn())
    if (user) {
      const q = query(adminNotificationsCollection, orderBy('createdAt', 'desc'));
      unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const notifs: AdminNotification[] = [];
        snapshot.forEach(doc => notifs.push({ id: doc.id, ...(doc.data() as any) } as AdminNotification));
        callback(notifs);
      }, (error) => {
        console.warn('Notifications listener error:', error.message);
        callback([]);
      });
    } else {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }
      callback([]);
    }
  });

  return () => {
    unsubscribeAuth();
    if (unsubscribeSnapshot) unsubscribeSnapshot();
  };
};

export const deleteAdminNotification = async (notifId: string) => {
  if (!isFirebaseConfigured) return;
  try {
    await deleteDoc(doc(db, 'adminNotifications', notifId));
  } catch (e) {
    console.error('Error deleting notification:', e);
    throw e;
  }
};


export const createUserNotification = async (userId: string, data: { title: string, message: string, type: string }) => {
  if (!isFirebaseConfigured || !userId) return;
  try {
    const notifRef = doc(collection(db, `notifications/${userId}/items`));
    await setDoc(notifRef, {
      ...data,
      createdAt: serverTimestamp(),
      read: false
    });
  } catch (e) {
    console.error('Error creating user notification:', e);
  }
};

export const getUserNotificationsRealtime = (callback: (notifications: any[]) => void) => {
  if (!isFirebaseConfigured || !auth.currentUser) return () => {};
  const q = query(
    collection(db, `notifications/${auth.currentUser.uid}/items`),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  return onSnapshot(q, (snapshot) => {
    const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
    callback(notifs);
  }, (error) => {
    console.warn('User notifications listener error:', error.message);
    callback([]);
  });
};

export const markUserNotificationsAsRead = async (userId?: string) => {
  if (!isFirebaseConfigured) return;
  const targetUid = userId || auth.currentUser?.uid;
  if (!targetUid) return;
  try {
    const q = query(
      collection(db, `notifications/${targetUid}/items`),
      where('read', '==', false),
      limit(50)
    );
    const unreadSnap = await getDocs(q);
    if (unreadSnap.empty) return;

    const batch = writeBatch(db);
    unreadSnap.forEach((notifDoc) => {
      batch.update(notifDoc.ref, { read: true });
    });
    await batch.commit();
  } catch (e) {
    console.warn('Error marking notifications as read:', e);
  }
};

export const markGroupNotificationsAsRead = async (groupId: string, userId?: string) => {
  if (!isFirebaseConfigured || !groupId) return;
  const targetUid = userId || auth.currentUser?.uid;
  if (!targetUid) return;
  try {
    const q = query(
      collection(db, `notifications/${targetUid}/items`),
      where('read', '==', false),
      limit(100)
    );
    const unreadSnap = await getDocs(q);
    if (unreadSnap.empty) return;

    const batch = writeBatch(db);
    let updatedCount = 0;
    unreadSnap.forEach((notifDoc) => {
      const data = notifDoc.data();
      if (data?.meta?.groupId === groupId || (data?.type === 'study_group_message' && data?.meta?.groupId === groupId)) {
        batch.update(notifDoc.ref, { read: true });
        updatedCount++;
      }
    });
    if (updatedCount > 0) {
      await batch.commit();
    }
  } catch (e) {
    console.warn('Error marking group notifications as read:', e);
  }
};


// 5. Analytics
export const recordAdImpression = async (adId: string) => {
  if (!isFirebaseConfigured || !adId) return;
  const adRef = doc(adsCollection, adId);
  await updateDoc(adRef, { 'stats.impressions': increment(1) });
  
  // Also update daily analytics
  const today = new Date().toISOString().split('T')[0];
  const analyticsId = `${adId}_${today}`;
  const analyticsRef = doc(adAnalyticsCollection, analyticsId);
  const snap = await getDoc(analyticsRef);
  if (snap.exists()) {
    await updateDoc(analyticsRef, { impressions: increment(1) });
  } else {
    await setDoc(analyticsRef, { adId, date: today, impressions: 1, clicks: 0 });
  }
};

export const recordAdClick = async (adId: string) => {
  if (!isFirebaseConfigured || !adId) return;
  const adRef = doc(adsCollection, adId);
  await updateDoc(adRef, { 'stats.clicks': increment(1) });
  
  const today = new Date().toISOString().split('T')[0];
  const analyticsId = `${adId}_${today}`;
  const analyticsRef = doc(adAnalyticsCollection, analyticsId);
  await updateDoc(analyticsRef, { clicks: increment(1) });
};

export const getAdAnalytics = async (adId: string): Promise<AdAnalytics[]> => {
  if (!isFirebaseConfigured || !adId) return [];
  const q = query(adAnalyticsCollection, where('adId', '==', adId), orderBy('date', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...(doc.data() as any)
  } as AdAnalytics));
};

// 6. Dashboard Stats
export interface DashboardStats {
  totalUsers: number;
  activeUsers24h: number;
  totalEvents: number;
  activeAds: number;
  totalImpressions: number;
  totalClicks: number;
}

export const getDashboardStats = async (): Promise<DashboardStats> => {
  if (!isFirebaseConfigured || !auth.currentUser) return { totalUsers: 0, activeUsers24h: 0, totalEvents: 0, activeAds: 0, totalImpressions: 0, totalClicks: 0 };
  
  try {
    const [usersSnap, eventsSnap, adsSnap] = await Promise.all([
      getDocs(usersCollection),
      getDocs(eventsCollection),
      getDocs(query(adsCollection, where('status', '==', 'active')))
    ]);

    let totalImpressions = 0;
    let totalClicks = 0;
    
    const allAds = await getDocs(adsCollection);
    allAds.forEach(doc => {
      const data = doc.data() as Advertisement;
      totalImpressions += data.stats?.impressions || 0;
      totalClicks += data.stats?.clicks || 0;
    });

    return {
      totalUsers: usersSnap.size,
      activeUsers24h: usersSnap.docs.filter(d => {
        const data = d.data() as any;
        const last = data.lastActive?.toDate();
        return last && (Date.now() - last.getTime() < 24 * 60 * 60 * 1000);
      }).length,
      totalEvents: eventsSnap.size,
      activeAds: adsSnap.size,
      totalImpressions,
      totalClicks
    };
  } catch (e) {
    console.error('Error fetching dashboard stats:', e);
    return { totalUsers: 0, activeUsers24h: 0, totalEvents: 0, activeAds: 0, totalImpressions: 0, totalClicks: 0 };
  }
};


export const getSemesterDates = async (universityId: string) => {
  if (!isFirebaseConfigured || !universityId) return null;
  try {
    const docRef = doc(db, 'settings', `semester_${universityId}`);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as { startDate: string; endDate: string };
    }
    // Fallback to legacy global settings if university-specific doesn't exist
    const legacyRef = doc(db, 'settings', 'semester');
    const legacySnap = await getDoc(legacyRef);
    if (legacySnap.exists()) {
      return legacySnap.data() as { startDate: string; endDate: string };
    }
    return null;
  } catch (e) {
    console.error('Error getting semester dates:', e);
    return null;
  }
};

export const setSemesterDates = async (universityId: string, startDate: string, endDate: string) => {
  if (!isFirebaseConfigured || !universityId) return;
  try {
    const docRef = doc(db, 'settings', `semester_${universityId}`);
    await setDoc(docRef, { startDate, endDate });
  } catch (e) {
    console.error('Error setting semester dates:', e);
    throw e;
  }
};

export const toggleAdminStatus = async (userId: string, currentStatus: boolean) => {
  if (!isFirebaseConfigured) return;
  try {
    await updateDoc(doc(db, 'users', userId), { isAdmin: !currentStatus });
  } catch (e) {
    console.error('Error toggling admin status:', e);
    throw e;
  }
};

export const suspendUser = async (userId: string) => {
  if (!isFirebaseConfigured) return;
  try {
    await updateDoc(doc(db, 'users', userId), { isSuspended: true });
  } catch (e) {
    console.error('Error suspending user:', e);
    throw e;
  }
};

export const changeUserUniversity = async (userId: string, newUniversityId: string) => {
  if (!isFirebaseConfigured) return;
  try {
    const { getUniversityConfig } = await import('../../config/universities');
    const uniConfig = getUniversityConfig(newUniversityId);
    const updateData = {
      universityId: uniConfig.id,
      university: uniConfig.name,
    };

    await updateDoc(doc(db, 'users', userId), updateData);
    
    // Also update profile if it exists
    try {
      await updateDoc(doc(db, 'profiles', userId), updateData);
    } catch (e) {
      // Profile might not exist yet, ignore
    }
  } catch (e) {
    console.error('Error changing university:', e);
    throw e;
  }
};

export const verifyUserAccount = async (userId: string) => {
  if (!isFirebaseConfigured) return;
  try {
    await updateDoc(doc(db, 'users', userId), { isVerified: true });
  } catch (e) {
    console.error('Error verifying user account:', e);
    throw e;
  }
};

// 5. System Maintenance
export const clearAllMessages = async () => {
  if (!isFirebaseConfigured || !(auth as any)?.currentUser) return;
  
  // Only admins should ideally call this, but we'll rely on firestore rules 
  // and the fact that this is only exposed in the AdminPanel UI.
  
  const conversationsSnapshot = await getDocs(conversationsCollection);
  const totalConvs = conversationsSnapshot.docs.length;
  let clearedCount = 0;

  for (const convDoc of conversationsSnapshot.docs) {
    const messagesRef = collection(db, `conversations/${convDoc.id}/messages`);
    const messagesSnapshot = await getDocs(messagesRef);
    
    const batch = writeBatch(db);
    messagesSnapshot.docs.forEach((msgDoc) => {
      batch.delete(msgDoc.ref);
    });
    
    // Reset last message
    batch.update(convDoc.ref, {
      lastMessage: {
        text: 'Chat history cleared for encryption update',
        timestamp: serverTimestamp(),
        senderId: 'system'
      },
      unreadCount: 0
    });

    await batch.commit();
    clearedCount++;
  }
  
  return { conversationsProcessed: clearedCount };
};
export const clearAllEvents = async () => {
  if (!isFirebaseConfigured) return;
  try {
    const snapshot = await getDocs(eventsCollection);
    const batch = writeBatch(db);
    snapshot.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    return { count: snapshot.size };
  } catch (e) {
    console.error('Error clearing events:', e);
    throw e;
  }
};

export const clearAllAds = async () => {
  if (!isFirebaseConfigured) return;
  try {
    const snapshot = await getDocs(adsCollection);
    const batch = writeBatch(db);
    snapshot.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    return { count: snapshot.size };
  } catch (e) {
    console.error('Error clearing ads:', e);
    throw e;
  }
};

// --- HANGOUTS ---
export interface Hangout {
  id?: string;
  title: string;
  category: string;
  location: string;
  date: string;
  time: string;
  creatorId: string;
  invitedFriends: string[];
  acceptedFriends: string[];
  status: 'pending' | 'active' | 'completed';
  createdAt: Timestamp;
}

export const createHangout = async (hangoutData: Omit<Hangout, 'id' | 'createdAt' | 'acceptedFriends' | 'status'>) => {
  if (!isFirebaseConfigured || !auth.currentUser) return null;
  try {
    const newDocRef = doc(collection(db, 'hangouts'));
    const docId = newDocRef.id;

    // Use REST API to completely bypass the JS SDK's broken write queue
    const token = await auth.currentUser.getIdToken();
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
    
    const fields: any = {
      title: { stringValue: hangoutData.title },
      category: { stringValue: hangoutData.category },
      location: { stringValue: hangoutData.location },
      date: { stringValue: hangoutData.date },
      time: { stringValue: hangoutData.time },
      creatorId: { stringValue: hangoutData.creatorId },
      status: { stringValue: 'pending' },
      createdAt: { timestampValue: new Date().toISOString() },
      invitedFriends: { arrayValue: { values: hangoutData.invitedFriends.map(id => ({ stringValue: id })) } },
      acceptedFriends: { arrayValue: { values: [] } }
    };

    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/hangouts/${docId}`, {
      method: 'PATCH', // PATCH creates or updates
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Server Rejected Hangout: ${res.status} ${errorText}`);
    }
    
    // Notify invited friends (fire-and-forget — don't block the UI)
    for (const friendId of hangoutData.invitedFriends) {
      createUserNotification(friendId, {
        title: 'New Hangout Request! 🎉',
        message: `You were invited to "${hangoutData.title}" at ${hangoutData.location}`,
        type: 'hangout',
        hangoutId: docId
      } as any).catch((e) => console.warn('Hangout notification failed:', e));
    }
    return docId;
  } catch (error) {
    console.error('Error creating hangout:', error);
    throw error;
  }
};

export const acceptHangout = async (hangoutId: string) => {
  if (!isFirebaseConfigured || !auth.currentUser) return false;
  try {
    const token = await auth.currentUser.getIdToken();
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
    
    const payload = {
      writes: [{
        transform: {
          document: `projects/${projectId}/databases/(default)/documents/hangouts/${hangoutId}`,
          fieldTransforms: [
            {
              fieldPath: 'acceptedFriends',
              appendMissingElements: {
                values: [{ stringValue: auth.currentUser.uid }]
              }
            },
            {
              fieldPath: 'invitedFriends',
              removeAllFromArray: {
                values: [{ stringValue: auth.currentUser.uid }]
              }
            }
          ]
        }
      }]
    };

    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(await res.text());
    return true;
  } catch (error) {
    console.error('Error accepting hangout:', error);
    return false;
  }
};

export const rejectHangout = async (hangoutId: string) => {
  if (!isFirebaseConfigured || !auth.currentUser) return false;
  try {
    const token = await auth.currentUser.getIdToken();
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
    
    const payload = {
      writes: [{
        transform: {
          document: `projects/${projectId}/databases/(default)/documents/hangouts/${hangoutId}`,
          fieldTransforms: [{
            fieldPath: 'invitedFriends',
            removeAllFromArray: {
              values: [{ stringValue: auth.currentUser.uid }]
            }
          }]
        }
      }]
    };

    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(await res.text());
    return true;
  } catch (error) {
    console.error('Error rejecting hangout:', error);
    return false;
  }
};

export const getHangoutsRealtime = (callback: (hangouts: Hangout[], error: string | null) => void) => {
  if (!isFirebaseConfigured) {
    callback([], null);
    return () => {};
  }

  let unsubSnapshot: (() => void) | null = null;

  const unsubAuth = onAuthStateChanged(auth, (user) => {
    if (unsubSnapshot) {
      unsubSnapshot();
      unsubSnapshot = null;
    }

    if (user) {
      const hangoutsRef = collection(db, 'hangouts');
      const q = query(hangoutsRef);

      unsubSnapshot = onSnapshot(q, (snapshot) => {
        const hangouts: Hangout[] = [];
        const uid = user.uid;
        snapshot.forEach(doc => {
          const data = { id: doc.id, ...(doc.data() as any) } as Hangout;
          hangouts.push(data);
        });
        callback(hangouts, null);
      }, (err) => {
        console.error('Error in getHangoutsRealtime:', err);
        callback([], err.message);
      });
    } else {
      callback([], null);
    }
  });

  return () => {
    unsubAuth();
    if (unsubSnapshot) unsubSnapshot();
  };
};

// --- ADMINISTRATIVE UTILITIES ---
export const backfillLegacyUniversityData = async () => {
  if (!isFirebaseConfigured || !auth.currentUser) return;
  console.log('Starting backfill of legacy data to vit-vellore...');
  
  try {
    const defaultUni = 'vit-vellore';
    let totalUpdated = 0;

    // 1. Backfill Events
    const eventsSnap = await getDocs(eventsCollection);
    for (const d of eventsSnap.docs) {
      const data = d.data() as any;
      if (!data.universityId) {
        await updateDoc(d.ref, { universityId: defaultUni });
        totalUpdated++;
      }
    }

    // 2. Backfill Pulses
    const pulsesSnap = await getDocs(collection(db, 'pulses'));
    for (const d of pulsesSnap.docs) {
      const data = d.data() as any;
      if (!data.universityId) {
        await updateDoc(d.ref, { universityId: defaultUni });
        totalUpdated++;
      }
    }

    // 3. Backfill CheckIns
    const checkInsSnap = await getDocs(collection(db, 'checkins'));
    for (const d of checkInsSnap.docs) {
      const data = d.data() as any;
      if (!data.universityId) {
        await updateDoc(d.ref, { universityId: defaultUni });
        totalUpdated++;
      }
    }

    // 4. Backfill Users and Profiles
    const usersSnap = await getDocs(usersCollection);
    for (const d of usersSnap.docs) {
      // Force update all users to ensure consistency
      await updateDoc(d.ref, { 
        universityId: defaultUni,
        university: 'VIT Vellore'
      });
      totalUpdated++;
    }

    const profilesSnap = await getDocs(collection(db, 'profiles'));
    for (const d of profilesSnap.docs) {
      await updateDoc(d.ref, { 
        universityId: defaultUni,
        university: 'VIT Vellore'
      });
      totalUpdated++;
    }

    console.log(`Backfill complete! Updated ${totalUpdated} legacy documents with universityId: ${defaultUni}`);
    return totalUpdated;
  } catch (error) {
    console.error('Error during backfill:', error);
    throw error;
  }
};

// ==========================================
// USER REPORTING
// ==========================================

export interface Report {
  id?: string;
  reportedUserId: string;
  reporterId: string;
  status: 'pending' | 'reviewed' | 'resolved';
  createdAt: number;
}

export const submitReport = async (reportedUserId: string) => {
  if (!isFirebaseConfigured || !auth.currentUser) return;
  const reportsRef = collection(db, 'reports');
  await addDoc(reportsRef, {
    reportedUserId,
    reporterId: auth.currentUser.uid,
    status: 'pending',
    createdAt: Date.now()
  });
};

export const getReports = async (): Promise<Report[]> => {
  if (!isFirebaseConfigured) return [];
  const reportsRef = collection(db, 'reports');
  const q = query(reportsRef, orderBy('createdAt', 'desc'));
  try {
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
  } catch (error) {
    console.error("Error fetching reports:", error);
    return [];
  }
};

export const updateReportStatus = async (reportId: string, status: 'pending' | 'reviewed' | 'resolved') => {
  if (!isFirebaseConfigured) return;
  const docRef = doc(db, 'reports', reportId);
  await updateDoc(docRef, { status });
};

// ==========================================
// BLOCK USERS
// ==========================================

export const blockUser = async (userIdToBlock: string) => {
  if (!isFirebaseConfigured || !auth.currentUser) return;
  const userRef = doc(db, 'profiles', auth.currentUser.uid);
  await updateDoc(userRef, {
    'privacySettings.blockedUsers': arrayUnion(userIdToBlock)
  });
};

export const unblockUser = async (userIdToUnblock: string) => {
  if (!isFirebaseConfigured || !auth.currentUser) return;
  const userRef = doc(db, 'profiles', auth.currentUser.uid);
  await updateDoc(userRef, {
    'privacySettings.blockedUsers': arrayRemove(userIdToUnblock)
  });
};

export const getBlockedUsers = async (): Promise<string[]> => {
  if (!isFirebaseConfigured || !auth.currentUser) return [];
  try {
    const userRef = doc(db, 'profiles', auth.currentUser.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      return data.privacySettings?.blockedUsers || [];
    }
  } catch (error) {
    console.error("Error fetching blocked users:", error);
  }
  return [];
};

// Expose to window for easy manual execution in the browser console
if (typeof window !== 'undefined') {
  (window as any).runUniNestBackfill = backfillLegacyUniversityData;
}
