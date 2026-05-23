import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  AlertCircle,
  Loader2,
  ChevronUp,
  ChevronLeft,
  Edit3,
  MessageCircle,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserPlus,
  Users,
  ArrowDownUp,
  Calendar,
  X,
  PartyPopper,
  Clock,
  MapPin,
  Timer,
  ListTodo,
  Plus,
  Trash2,
  Play,
  Square,
  ChevronRight,
  CornerUpLeft,
  LayoutGrid,
} from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { formatEmailToName } from '../../../utils/nameUtils';
import { useUniversity } from '../../../hooks/useUniversity';
import {
  createConversation,
  getConversations,
  getEnhancedFriendProfile,
  getFriendRequests,
  getFriends,
  getMessages,
  getProfile,
  getStudyGroups,
  acceptStudyGroupRequest,
  declineStudyGroupRequest,
  StudyGroup,
  getUserProfile,
  ignoreFriendRequest,
  markMessagesAsRead,
  acceptFriendRequest,
  sendMessage,
  inviteMembersToStudyGroup,
  getDiscoverableUsers,
  FriendRequest,
  UserProfile,
  AdminNotification,
  getAllNotificationsRealtime,
  acceptPulseRequest,
  declinePulseRequest,
  getPulses,
  Pulse,
  getFriendTimetable,
  loadTimetable,
  createStudyGroup,
  leaveStudyGroup,
  deleteStudyGroup,
  deleteConversationWithMessages,
  getUserNotificationsRealtime,
  markUserNotificationsAsRead,
  markGroupNotificationsAsRead,

  Hangout,
  getHangoutsRealtime,
  acceptHangout,
  rejectHangout,
  getGroupTodos,
  addGroupTodo,
  toggleGroupTodo,
  deleteGroupTodo,
  type StudyGroupTodo,
} from '../../../utils/firebase/firestore';
import {
  listenToMessages as listenToChatMessages,
  sendMessageOptimistic,
  markAsSeen,
  sendTypingStatus,
  clearTypingStatus,
  listenToTyping,
  isUserTyping,
  loadMoreMessages,
  hasMoreMessages,
  retryMessage,
  loadCacheFromLS,
  type ChatMessage,
  type MessageStatus,
  type TypingState,
} from '../../../utils/firebase/chatService';
import { auth, isFirebaseConfigured } from '../../../utils/firebase/client';
import {
  decryptMessage,
  encryptMessage,
  deriveConversationKey,
} from '../../../utils/crypto';
import { computeCommonFreeSlots, formatTimeLabel } from '../../../utils/scheduleCompare';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { registerBackHandler } from '../../../utils/backButton';

type EnhancedFriendRequest = FriendRequest & {
  senderName?: string;
  senderAvatar?: string | null;
};

type Participant = {
  id: string;
  name: string;
  avatar: string | null;
  online: boolean;
  lastSeen: Date | null;
  isGroup?: boolean;
};

type Message = {
  id: string;
  text: string;
  timestamp: Date;
  senderId: string;
  recipientId?: string;
  encryptedContent?: string;
  status?: MessageStatus;
  _optimistic?: boolean;
  replyTo?: {
    id: string;
    text: string;
    senderName: string;
  } | null;
};

type Conversation = {
  id: string;
  participant: Participant;
  lastMessage: { text: string; timestamp: Date; senderId: string };
  unreadCount: number;
  messages: Message[];
  isGroup?: boolean;
};

type MessagesPageProps = {
  currentUser: { id: string; name?: string; displayName?: string; universityId?: string };
  onOpenProfile?: (user: any) => void;
  onNavigate?: (page: string) => void;
};

export function MessagesPage({ currentUser, onOpenProfile, onNavigate }: MessagesPageProps) {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const selectedConversationRef = useRef<Conversation | null>(null);
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);
  const [studyGroups, setStudyGroups] = useState<StudyGroup[]>([]);
  const activeStudyGroup = useMemo(() => {
    if (!selectedConversation?.isGroup) return null;
    return studyGroups.find((group) => group.id === selectedConversation.id) || null;
  }, [selectedConversation?.id, selectedConversation?.isGroup, studyGroups]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [friendRequests, setFriendRequests] = useState<EnhancedFriendRequest[]>([]);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [friendProfileNames, setFriendProfileNames] = useState<Record<string, string>>({});
  const friendProfileNamesRef = useRef<Record<string, string>>({});
  useEffect(() => {
    friendProfileNamesRef.current = friendProfileNames;
  }, [friendProfileNames]);

  const fetchUserProfileName = useCallback(async (uid: string): Promise<string> => {
    try {
      const uDoc = await getUserProfile(uid);
      if (uDoc) {
        const name = uDoc.name || uDoc.displayName || formatEmailToName(uDoc.email);
        if (name) return name;
      }
    } catch (e) {
      console.error('Error fetching user profile:', e);
    }
    try {
      const pDoc = await getProfile(uid);
      if (pDoc) {
        const name = pDoc.name || pDoc.displayName || formatEmailToName(pDoc.email);
        if (name) return name;
      }
    } catch (e) {
      console.error('Error fetching user profile fallback:', e);
    }
    return 'Member';
  }, []);
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [friendSearch, setFriendSearch] = useState('');
  const [surface, setSurface] = useState<'messages' | 'requests' | 'notifications'>('messages');

  const [showComposer, setShowComposer] = useState(false);
  const [processingRequests, setProcessingRequests] = useState<Set<string>>(new Set());
  const [sharedKeys, setSharedKeys] = useState<Record<string, CryptoKey>>({});
  const sharedKeysRef = useRef<Record<string, CryptoKey>>({});
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [myPulses, setMyPulses] = useState<Pulse[]>([]);
  const [hangouts, setHangouts] = useState<Hangout[]>([]);
  const [adminNotifications, setAdminNotifications] = useState<AdminNotification[]>([]);
  const [userNotifications, setUserNotifications] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<'recent' | 'unread'>('recent');
  
  // Study Group creation states
  const [showStudyGroupModal, setShowStudyGroupModal] = useState<boolean>(false);
  const [selectedFriendForStudy, setSelectedFriendForStudy] = useState<UserProfile | null>(null);
  const [commonFreeSlots, setCommonFreeSlots] = useState<Record<string, any[]>>({});
  const [myTimetable, setMyTimetable] = useState<any>({});
  const [newEvent, setNewEvent] = useState({ title: '', description: '' });
  const [groupOptionsTarget, setGroupOptionsTarget] = useState<StudyGroup | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [conversationSwipeOffsets, setConversationSwipeOffsets] = useState<Record<string, number>>({});
  const [deletingConversationIds, setDeletingConversationIds] = useState<Set<string>>(new Set());

  const myId = auth.currentUser?.uid || currentUser.id;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const groupLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextGroupClickRef = useRef<string | null>(null);
  const conversationSwipeRef = useRef<{ id: string; startX: number } | null>(null);
  const suppressNextConversationClickRef = useRef<string | null>(null);
  const university = useUniversity();
  const hasReceivedData = useRef(false);

  // Real-time chat state
  const [typingState, setTypingState] = useState<TypingState>({});
  const [loadingMore, setLoadingMore] = useState(false);
  const [canLoadMore, setCanLoadMore] = useState(true);
  const chatUpdateRef = useRef<((msgs: ChatMessage[]) => void) | null>(null);
  const [selectedHangoutAction, setSelectedHangoutAction] = useState<Hangout | null>(null);
  const [showStudyTools, setShowStudyTools] = useState(false);
  const [studyToolTab, setStudyToolTab] = useState<'focus' | 'invite'>('focus');
  const [activeInviteTab, setActiveInviteTab] = useState<'friends' | 'discover'>('friends');
  const [discoverableUsers, setDiscoverableUsers] = useState<UserProfile[]>([]);
  const [discoverableLoading, setDiscoverableLoading] = useState(false);
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');
  const [focusTimerMode, setFocusTimerMode] = useState<'pomodoro' | 'stopwatch'>('pomodoro');
  const [groupTodos, setGroupTodos] = useState<StudyGroupTodo[]>([]);
  const [todoInput, setTodoInput] = useState('');
  const [isAddingTodo, setIsAddingTodo] = useState(false);
  const [invitingMembers, setInvitingMembers] = useState<Set<string>>(new Set());
  const todoInputRef = useRef<HTMLInputElement>(null);

  // Helper: get hangout where a friend invited ME and I haven't responded yet
  const getPendingHangoutFromFriend = (friendId: string): Hangout | undefined => {
    return hangouts.find(h =>
      h.creatorId === friendId &&
      h.invitedFriends?.includes(myId) &&
      !h.acceptedFriends?.includes(myId) &&
      h.status === 'pending'
    );
  };

  // Helper: get hangout where I invited the friend and they haven't responded yet
  const getPendingHangoutToFriend = (friendId: string): Hangout | undefined => {
    return hangouts.find(h =>
      h.creatorId === myId &&
      h.invitedFriends?.includes(friendId) &&
      !h.acceptedFriends?.includes(friendId) &&
      h.status === 'pending'
    );
  };

  // Helper: get accepted hangout for a friend (either direction)
  const getAcceptedHangoutForFriend = (friendId: string): Hangout | undefined => {
    return hangouts.find(h => {
      if (h.status !== 'pending') return false;
      const isBetweenUs = 
        (h.creatorId === friendId && (h.acceptedFriends?.includes(myId) || h.invitedFriends?.includes(myId))) ||
        (h.creatorId === myId && h.acceptedFriends?.includes(friendId));
      const bothAccepted = 
        (h.creatorId === myId && h.acceptedFriends?.includes(friendId)) ||
        (h.creatorId === friendId && h.acceptedFriends?.includes(myId));
      return isBetweenUs && bothAccepted;
    });
  };

  // Helper: format time until hangout
  const getHangoutTimeLeft = (h: Hangout): string => {
    if (!h.date || !h.time) return '';
    const target = new Date(`${h.date}T${h.time}`);
    const now = new Date();
    const diff = target.getTime() - now.getTime();
    if (diff <= 0) return 'Now!';
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (days > 0) return `${days}d ${hrs % 24}h`;
    if (hrs > 0) return `${hrs}h ${mins % 60}m`;
    return `${mins}m`;
  };

  useEffect(() => {
    const loadTimetableData = async () => {
      const myT = await loadTimetable();
      setMyTimetable(myT);
    };
    loadTimetableData();
  }, [currentUser]);

  useEffect(() => {
    return registerBackHandler(() => {
      if (showStudyGroupModal) {
        setShowStudyGroupModal(false);
        return true;
      }
      if (selectedHangoutAction) {
        setSelectedHangoutAction(null);
        return true;
      }
      if (groupOptionsTarget) {
        setGroupOptionsTarget(null);
        return true;
      }
      if (showStudyTools) {
        setShowStudyTools(false);
        return true;
      }
      if (selectedConversation) {
        setSelectedConversation(null);
        return true;
      }
      return false;
    });
  }, [showStudyGroupModal, selectedHangoutAction, groupOptionsTarget, showStudyTools, selectedConversation]);

  useEffect(() => {
    if (selectedFriendForStudy) {
      const fetchFreeTime = async () => {
        const friendTimetable = await getFriendTimetable(selectedFriendForStudy.uid);
        const common = computeCommonFreeSlots(myTimetable, friendTimetable);
        setCommonFreeSlots(common);
      };
      fetchFreeTime();
    }
  }, [selectedFriendForStudy, myTimetable]);

  useEffect(() => {
    const setupEncryption = async () => {
      if (!myId || conversations.length === 0) return;
      const nextKeys = { ...sharedKeysRef.current };
      let changed = false;

      for (const conversation of conversations) {
        const otherId = conversation.participant.id;
        if (!otherId || nextKeys[otherId]) continue;

        try {
          // Deterministic key for this conversation pair
          nextKeys[otherId] = await deriveConversationKey(myId, otherId);
          changed = true;
        } catch (error) {
          console.error('Failed to derive shared key for', otherId, error);
        }
      }

      if (changed) {
        sharedKeysRef.current = nextKeys;
        setSharedKeys(nextKeys);
      }
    };

    setupEncryption();
  }, [conversations, myId]);

  // Retroactively decrypt the conversations list once sharedKeys are derived
  useEffect(() => {
    if (conversations.length === 0 || Object.keys(sharedKeys).length === 0) return;

    let hasUpdates = false;

    Promise.all(
      conversations.map(async (conv) => {
        const currentSharedKey = sharedKeys[conv.participant.id];
        if (!currentSharedKey) return conv;

        const msgText = conv.lastMessage.text;
        const looksEncrypted = /^[A-Za-z0-9+/=]{20,}$/.test(msgText.trim());

        if (looksEncrypted) {
          try {
            const decrypted = await decryptMessage(msgText, currentSharedKey);
            if (!decrypted.startsWith('[E2EE Error')) {
              hasUpdates = true;
              return {
                ...conv,
                lastMessage: { ...conv.lastMessage, text: decrypted }
              };
            }
          } catch (e) {}
        }
        return conv;
      })
    ).then((updatedConversations) => {
      if (hasUpdates) {
        setConversations(updatedConversations);
      }
    });
  }, [sharedKeys]);

  useEffect(() => {
    if (!(isFirebaseConfigured && auth.currentUser)) {
      setConversations([]);
      setLoading(false);
      return;
    }

    auth.currentUser.getIdToken(true).catch(() => {});

    // Prevent flashing "No conversations" while waiting for server data.
    // onSnapshot fires immediately with local cache (often empty), so we
    // delay setting loading=false until real data arrives or a timeout elapses.
    const loadingTimeout = setTimeout(() => {
      if (!hasReceivedData.current) {
        hasReceivedData.current = true;
        setLoading(false);
      }
    }, 2500);

    const unsubscribe = getConversations(async (firebaseConversations) => {
      const next = await Promise.all(
        firebaseConversations.map(async (conversation) => {
          const otherParticipantId =
            conversation.participants.find((id) => id !== auth.currentUser?.uid) || '';

          const [participantProfile, participantProfileDoc] = await Promise.all([
            getUserProfile(otherParticipantId),
            getProfile(otherParticipantId),
          ]);

          let lastMessageText = conversation.lastMessage?.content || 'New conversation';
          const currentSharedKey = sharedKeysRef.current[otherParticipantId];
          if (currentSharedKey && lastMessageText !== 'New conversation') {
            try {
              const decrypted = await decryptMessage(lastMessageText, currentSharedKey);
              if (!decrypted.startsWith('[E2EE Error')) {
                lastMessageText = decrypted;
              }
            } catch {}
          }

          const isGhost = !!participantProfile?.privacySettings?.ghostMode;
          const showStatus = participantProfile?.privacySettings?.onlineStatusVisible !== false && !isGhost;
          const lastActiveDate = participantProfile?.lastActive?.toDate?.() || (participantProfile?.lastActive instanceof Date ? participantProfile.lastActive : null);
          const isOnline = showStatus && !!lastActiveDate && (Date.now() - lastActiveDate.getTime() < 5 * 60 * 1000);

          return {
            id: conversation.id || '',
            participant: {
              id: otherParticipantId,
              name: (participantProfileDoc as any)?.name || participantProfile?.displayName || 'User',
              avatar: participantProfile?.photoURL || null,
              online: isOnline,
              lastSeen: showStatus ? lastActiveDate : null,
            },
            lastMessage: {
              text: lastMessageText,
              timestamp: conversation.lastMessage?.timestamp?.toDate() || new Date(),
              senderId: conversation.lastMessage?.senderId || '',
            },
            unreadCount: ((conversation.lastMessage as any)?.senderId !== currentUser.id && (conversation.lastMessage as any)?.read === false) ? 1 : 0,
            messages: [],
          } as Conversation;
        })
      );

      setConversations((prevConvs) => {
        return next.map((conv) => {
          const prevConv = prevConvs.find((c) => c.id === conv.id);
          return prevConv ? { ...conv, messages: prevConv.messages } : conv;
        });
      });
      
      const unread = next.reduce((total, conv) => total + (conv.unreadCount || 0), 0);
      setUnreadTotal(unread);

      // Only transition out of loading once we have real data or the first snapshot completes
      if (!hasReceivedData.current || next.length > 0) {
        hasReceivedData.current = true;
        setLoading(false);
      }

      setSelectedConversation((prev) => {
        if (!prev) return prev;
        const updated = next.find((conversation) => conversation.id === prev.id);
        if (!updated) return prev;
        return {
          ...updated,
          messages: prev.messages,
        };
      });
    });

    return () => {
      clearTimeout(loadingTimeout);
      unsubscribe();
    };
  }, [currentUser?.id, university.id]);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth.currentUser) return;
    const unsub = getPulses((list) => {
      setMyPulses(list.filter(p => p.createdBy === (auth.currentUser?.uid || currentUser.id)));
    }, university.id);
    return () => unsub();
  }, [university.id, currentUser?.id]);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const unsubAdmin = getAllNotificationsRealtime((notifs) => {
      setAdminNotifications(notifs);
    });
    const unsubUser = getUserNotificationsRealtime((notifs) => {
      setUserNotifications(notifs);
    });
    return () => {
      unsubAdmin();
      unsubUser();
    };
  }, [currentUser?.id]);

  const notifications = useMemo(() => {
    const combined = [
      ...adminNotifications.map(n => ({ ...n, category: 'admin' as const })),
      ...userNotifications.map(n => ({ ...n, category: 'user' as const }))
    ];
    return combined.sort((a, b) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 
                 (a.createdAt instanceof Date ? a.createdAt.getTime() : 0);
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 
                 (b.createdAt instanceof Date ? b.createdAt.getTime() : 0);
      return tb - ta;
    });
  }, [adminNotifications, userNotifications]);

  const unreadNotificationCount = useMemo(
    () => userNotifications.filter((notif) => !notif.read).length,
    [userNotifications]
  );

  const pendingStudyRequestCount = useMemo(
    () =>
      studyGroups
        .filter((group) => group.createdBy === auth.currentUser?.uid)
        .reduce((sum, group) => sum + (group.joinRequests?.length || 0), 0),
    [studyGroups]
  );

  const pendingPulseRequestCount = useMemo(
    () => myPulses.reduce((sum, pulse) => sum + (pulse.joinRequests?.length || 0), 0),
    [myPulses]
  );

  const pendingHangoutRequestCount = useMemo(
    () => hangouts.filter((h) => h.status === 'pending' && h.invitedFriends.includes(myId)).length,
    [hangouts, myId]
  );

  const hasUnreadGroup = useCallback((groupId: string) => {
    return userNotifications.some(
      (n) => !n.read && n.type === 'study_group_message' && n.meta?.groupId === groupId
    );
  }, [userNotifications]);

  const totalPendingRequests = useMemo(
    () =>
      friendRequests.length +
      pendingStudyRequestCount +
      pendingPulseRequestCount +
      pendingHangoutRequestCount,
    [friendRequests.length, pendingStudyRequestCount, pendingPulseRequestCount, pendingHangoutRequestCount]
  );

  useEffect(() => {
    if (surface === 'notifications') {
      markUserNotificationsAsRead().catch(() => {});
    }
  }, [surface]);

  useEffect(() => {
    return () => {
      if (groupLongPressTimerRef.current) {
        clearTimeout(groupLongPressTimerRef.current);
        groupLongPressTimerRef.current = null;
      }
    };
  }, []);

  const clearGroupLongPress = useCallback(() => {
    if (groupLongPressTimerRef.current) {
      clearTimeout(groupLongPressTimerRef.current);
      groupLongPressTimerRef.current = null;
    }
  }, []);

  const startGroupLongPress = useCallback((group: StudyGroup) => {
    clearGroupLongPress();
    groupLongPressTimerRef.current = setTimeout(() => {
      suppressNextGroupClickRef.current = group.id || null;
      setGroupOptionsTarget(group);
    }, 550);
  }, [clearGroupLongPress]);

  const handleLeaveStudyGroup = useCallback(async () => {
    if (!selectedConversation?.isGroup) return;
    if (!window.confirm('Are you sure you want to leave this study group?')) return;
    try {
      await leaveStudyGroup(selectedConversation.id);
      toast.success('Left study group successfully');
      setShowStudyTools(false);
      setSelectedConversation(null);
    } catch (e: any) {
      toast.error('Failed to leave study group: ' + e.message);
    }
  }, [selectedConversation]);

  const handleDeleteGroupFromOptions = useCallback(async () => {
    if (!groupOptionsTarget?.id) return;
    if (groupOptionsTarget.createdBy !== myId) {
      toast.error('Only group owner can delete this study group.');
      return;
    }
    setDeletingGroupId(groupOptionsTarget.id);
    try {
      const ok = await deleteStudyGroup(groupOptionsTarget.id);
      if (!ok) {
        toast.error('Unable to delete study group right now.');
        return;
      }
      if (selectedConversation?.id === groupOptionsTarget.id) {
        setSelectedConversation(null);
      }
      setGroupOptionsTarget(null);
      toast.success('Study group deleted.');
    } catch (error) {
      console.error('Failed to delete study group:', error);
      toast.error('Failed to delete study group.');
    } finally {
      setDeletingGroupId(null);
    }
  }, [deleteStudyGroup, groupOptionsTarget, myId, selectedConversation?.id]);

  const clearConversationSwipe = useCallback((conversationId?: string) => {
    conversationSwipeRef.current = null;
    if (!conversationId) return;
    setConversationSwipeOffsets((prev) => {
      if (!prev[conversationId]) return prev;
      const next = { ...prev };
      delete next[conversationId];
      return next;
    });
  }, []);

  const handleConversationDelete = useCallback(async (conversation: Conversation) => {
    if (!conversation?.id || conversation.isGroup) return;
    if (deletingConversationIds.has(conversation.id)) return;

    setDeletingConversationIds((prev) => new Set(prev).add(conversation.id));
    try {
      const ok = await deleteConversationWithMessages(conversation.id);
      if (!ok) {
        toast.error('Unable to delete chat right now.');
        return;
      }
      setConversations((prev) => prev.filter((c) => c.id !== conversation.id));
      if (selectedConversation?.id === conversation.id) {
        setSelectedConversation(null);
      }
      toast.success('Chat deleted.');
    } catch (error) {
      console.error('Failed to delete chat:', error);
      toast.error('Failed to delete chat.');
    } finally {
      setDeletingConversationIds((prev) => {
        const next = new Set(prev);
        next.delete(conversation.id);
        return next;
      });
      clearConversationSwipe(conversation.id);
    }
  }, [clearConversationSwipe, deleteConversationWithMessages, deletingConversationIds, selectedConversation?.id]);

  const beginConversationSwipe = useCallback((conversationId: string, x: number) => {
    conversationSwipeRef.current = { id: conversationId, startX: x };
  }, []);

  const moveConversationSwipe = useCallback((conversationId: string, x: number) => {
    const active = conversationSwipeRef.current;
    if (!active || active.id !== conversationId) return;
    const delta = x - active.startX;
    if (delta >= 0) {
      setConversationSwipeOffsets((prev) => ({ ...prev, [conversationId]: 0 }));
      return;
    }
    const clamped = Math.max(-96, Math.min(0, delta));
    setConversationSwipeOffsets((prev) => ({ ...prev, [conversationId]: clamped }));
  }, []);

  const endConversationSwipe = useCallback((conversation: Conversation) => {
    const offset = conversationSwipeOffsets[conversation.id] || 0;
    conversationSwipeRef.current = null;

    if (offset <= -84 && !conversation.isGroup) {
      suppressNextConversationClickRef.current = conversation.id;
      handleConversationDelete(conversation).catch(() => {});
      return;
    }
    clearConversationSwipe(conversation.id);
  }, [clearConversationSwipe, conversationSwipeOffsets, handleConversationDelete]);

  // ─── Real-time message listener via chatService ────────────────────────────
  useEffect(() => {
    if (!selectedConversation || !(isFirebaseConfigured && auth.currentUser)) return;

    auth.currentUser.getIdToken(true).catch(() => {});
    setCanLoadMore(true);

    // ── Instant load from localStorage (show cached messages immediately) ──
    const cachedCMs = loadCacheFromLS(selectedConversation.id);
    if (cachedCMs.length > 0) {
      // Map to Message[] without decryption first (show immediately)
      const cachedMessages: Message[] = cachedCMs.map((cm) => ({
        id: cm.id,
        text: cm.text,
        encryptedContent: cm.encryptedContent,
        timestamp: cm.createdAt,
        senderId: cm.senderId,
        recipientId: cm.receiverId,
        status: cm.status,
        _optimistic: false,
        replyTo: cm.replyTo,
      } as Message));
      setSelectedConversation((prev) =>
        prev?.id === selectedConversation.id ? { ...prev, messages: cachedMessages } : prev
      );
      // Scroll to bottom for cached messages
      isNearBottomRef.current = true;
    }

    // Callback that transforms ChatMessage[] → Message[] with decryption
    const handleUpdate = async (chatMessages: ChatMessage[]) => {
      const activeConv = selectedConversationRef.current;
      if (!activeConv) return;

      const otherId = activeConv.participant.id;
      const currentSharedKey = sharedKeysRef.current[otherId];

      const mappedMessages: Message[] = await Promise.all(
        chatMessages.map(async (cm) => {
          let text = cm.text;
          const raw = cm.encryptedContent || cm.text;
          const looksEncrypted = /^[A-Za-z0-9+/=]{20,}$/.test(raw.trim());

          if (currentSharedKey && looksEncrypted && !cm._optimistic) {
            const decrypted = await decryptMessage(raw, currentSharedKey);
            if (!decrypted.startsWith('[E2EE Error')) {
              text = decrypted;
            }
          }

          return {
            id: cm.id,
            text,
            encryptedContent: raw,
            timestamp: cm.createdAt,
            senderId: cm.senderId,
            recipientId: cm.receiverId,
            status: cm.status,
            _optimistic: cm._optimistic,
            replyTo: cm.replyTo,
          } as Message;
        })
      );

      // Fetch missing profiles for group senders
      const uniqueMissingUids = Array.from(
        new Set(
          chatMessages
            .map((cm) => cm.senderId)
            .filter((uid) => uid && uid !== myId)
        )
      );

      if (uniqueMissingUids.length > 0) {
        const missing = uniqueMissingUids.filter((uid) => !friendProfileNamesRef.current[uid]);
        if (missing.length > 0) {
          Promise.all(missing.map((uid) => fetchUserProfileName(uid)))
            .then((names) => {
              const nextMap: Record<string, string> = {};
              missing.forEach((uid, index) => {
                const name = names[index];
                if (name && name !== 'Member') {
                  nextMap[uid] = name;
                }
              });
              if (Object.keys(nextMap).length > 0) {
                setFriendProfileNames((prev) => ({ ...prev, ...nextMap }));
              }
            })
            .catch((err) => console.error('Error fetching sender profiles:', err));
        }
      }

      setSelectedConversation((prev) =>
        prev && prev.id === activeConv.id ? { ...prev, messages: mappedMessages } : prev
      );
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === activeConv.id
            ? {
                ...conversation,
                messages: mappedMessages,
                lastMessage:
                  mappedMessages.length > 0
                    ? {
                        text: mappedMessages[mappedMessages.length - 1].text,
                        timestamp: mappedMessages[mappedMessages.length - 1].timestamp,
                        senderId: mappedMessages[mappedMessages.length - 1].senderId,
                      }
                    : conversation.lastMessage,
              }
            : conversation
        )
      );
      if (activeConv.isGroup) {
        markGroupNotificationsAsRead(activeConv.id).catch(() => {});
      }
    };

    chatUpdateRef.current = handleUpdate;

    const unsubMessages = listenToChatMessages(
      selectedConversation.id, 
      handleUpdate, 
      30, 
      !!selectedConversation.isGroup
    );

    // Typing indicator listener
    const unsubTyping = !selectedConversation.isGroup 
      ? listenToTyping(selectedConversation.id, (ts) => setTypingState(ts))
      : () => {};

    // Mark messages as seen when chat opens
    if (!selectedConversation.isGroup) {
      markAsSeen(selectedConversation.id);
    }

    return () => {
      unsubMessages();
      unsubTyping();
      chatUpdateRef.current = null;
      if (!selectedConversation.isGroup) {
        clearTypingStatus(selectedConversation.id);
      }
    };
  }, [selectedConversation?.id, selectedConversation?.isGroup]);

  useEffect(() => {
    if (!selectedConversation) return;
    const otherId = selectedConversation.participant.id;
    const currentSharedKey = sharedKeys[otherId];
    if (!currentSharedKey) return;

    let hasUpdates = false;

    Promise.all(
      selectedConversation.messages.map(async (msg) => {
        const looksEncrypted = msg.encryptedContent && /^[A-Za-z0-9+/=]{20,}$/.test(msg.encryptedContent.trim());
        if (looksEncrypted && msg.text === msg.encryptedContent) {
          try {
            const decrypted = await decryptMessage(msg.encryptedContent, currentSharedKey);
            if (!decrypted.startsWith('[E2EE Error')) {
              hasUpdates = true;
              return { ...msg, text: decrypted };
            }
          } catch (e) {}
        }
        return msg;
      })
    ).then((updatedMessages) => {
      if (hasUpdates) {
        setSelectedConversation((prev) => (prev ? { ...prev, messages: updatedMessages } : prev));
      }
    });
  }, [sharedKeys, selectedConversation?.id]);

  useEffect(() => {
    if (!(isFirebaseConfigured && auth.currentUser)) {
      setRequestsLoading(false);
      return;
    }

    const unsubscribeRequests = getFriendRequests(async (requests) => {
      const enhancedRequests = await Promise.all(
        requests.map(async (req) => {
          try {
            const profile = await getProfile(req.senderId);
            return {
              ...req,
              senderName: profile?.name || profile?.displayName || 'User'
            };
          } catch {
            return req;
          }
        })
      );
      setFriendRequests(enhancedRequests as EnhancedFriendRequest[]);
      setRequestsLoading(false);
    });

    const unsubscribeStudyGroups = getStudyGroups((groups) => {
      setStudyGroups(groups);
    }, currentUser?.universityId);

    return () => {
      unsubscribeRequests();
      unsubscribeStudyGroups();
    };
  }, [currentUser?.id]);

  const [hangoutsError, setHangoutsError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeHangouts = getHangoutsRealtime((h, err) => {
      setHangouts(h);
      if (err) setHangoutsError(err);
    });
    return () => unsubscribeHangouts();
  }, [currentUser?.id]);

  useEffect(() => {
    const unsubscribe = getFriends((list) => {
      setFriends(list);
      Promise.all(list.map((friend) => getProfile(friend.uid)))
        .then((profiles) => {
          const nextMap: Record<string, string> = {};
          profiles.forEach((profile, index) => {
            const uid = list[index]?.uid;
            const name = profile?.name;
            if (uid && typeof name === 'string' && name.trim()) {
              nextMap[uid] = name.trim();
            }
          });
          setFriendProfileNames((prev) => ({ ...prev, ...nextMap }));
        })
        .catch(() => {});
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!activeStudyGroup || !activeStudyGroup.members) return;
    const members = activeStudyGroup.members;
    const missing = members.filter((uid) => uid && uid !== myId && !friendProfileNamesRef.current[uid]);
    if (missing.length > 0) {
      Promise.all(missing.map((uid) => fetchUserProfileName(uid)))
        .then((names) => {
          const nextMap: Record<string, string> = {};
          missing.forEach((uid, index) => {
            const name = names[index];
            if (name && name !== 'Member') {
              nextMap[uid] = name;
            }
          });
          if (Object.keys(nextMap).length > 0) {
            setFriendProfileNames((prev) => ({ ...prev, ...nextMap }));
          }
        })
        .catch((err) => console.error('Error pre-fetching group members profiles:', err));
    }
  }, [activeStudyGroup?.id, activeStudyGroup?.members, myId, fetchUserProfileName]);

  useEffect(() => {
    if (!selectedConversation?.isGroup) {
      setGroupTodos([]);
      return;
    }
    const unsub = getGroupTodos(selectedConversation.id, (todos) => {
      setGroupTodos(todos);
    });
    return () => unsub();
  }, [selectedConversation?.id, selectedConversation?.isGroup]);

  // Smart auto-scroll: only scroll to bottom when the user is already near the bottom.
  // This prevents jarring jumps when loading history or when a new message arrives while
  // the user is reading older messages.
  const isNearBottomRef = useRef(true);

  const handleMessagesScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distFromBottom < 150;
  }, []);

  useEffect(() => {
    const msgs = selectedConversation?.messages;
    if (!msgs?.length) return;
    if (isNearBottomRef.current) {
      // Use 'instant' for the first load, 'smooth' for new messages
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedConversation?.messages?.length]);

  const filteredConversations = useMemo(() => {
    let result = conversations;
    
    if (sortBy === 'unread') {
      result = result.filter(c => c.unreadCount > 0);
    }
    
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((conversation) => {
        const haystack = [
          conversation.participant.name,
          conversation.lastMessage.text,
        ].join(' ').toLowerCase();
        return haystack.includes(query);
      });
    }
    
    return result;
  }, [conversations, searchQuery, sortBy]);



  const filteredFriends = useMemo(() => {
    if (!friendSearch.trim()) return [];
    const query = friendSearch.toLowerCase();
    return friends.filter((friend) => {
      const resolved =
        formatEmailToName(friendProfileNames[friend.uid] || friend.displayName || friend.email);
      return resolved.toLowerCase().includes(query);
    });
  }, [friendProfileNames, friendSearch, friends]);

  const friendNameById = useMemo(() => {
    const nameMap: Record<string, string> = {};
    friends.forEach((friend) => {
      nameMap[friend.uid] = formatEmailToName(
        friendProfileNames[friend.uid] || friend.displayName || friend.name || friend.email || 'User'
      );
    });
    return nameMap;
  }, [friends, friendProfileNames]);

  const invitableFriends = useMemo(() => {
    if (!activeStudyGroup) return [];
    const memberSet = new Set(activeStudyGroup.members || []);
    return friends.filter((friend) => !memberSet.has(friend.uid));
  }, [activeStudyGroup, friends]);

  const preloadDiscoverable = useCallback(async (groupId: string) => {
    try {
      setDiscoverableLoading(true);
      const all = await getDiscoverableUsers(currentUser?.universityId || university.id);
      const group = studyGroups.find(g => g.id === groupId);
      const existing = new Set<string>(group && Array.isArray(group.members) ? group.members : []);
      const currentUid = myId;
      const filtered = all.filter((u) => u.uid !== currentUid && !existing.has(u.uid));
      setDiscoverableUsers(filtered);
    } catch (e) {
      console.error('Error loading discoverable users:', e);
      setDiscoverableUsers([]);
    } finally {
      setDiscoverableLoading(false);
    }
  }, [currentUser?.universityId, university.id, studyGroups, myId]);

  const getUserLabel = useCallback((uid?: string | null) => {
    if (!uid) return 'Member';
    if (uid === myId) return 'You';
    const rawName = friendProfileNames[uid] || friendNameById[uid] || 'Member';
    return formatEmailToName(rawName);
  }, [friendProfileNames, friendNameById, myId]);

  const handleAddTask = useCallback(async () => {
    const taskText = todoInput.trim();
    if (!taskText) {
      toast.error('Enter a task before adding.');
      return;
    }
    if (!selectedConversation?.id) {
      toast.error('Open a study group first.');
      return;
    }

    setIsAddingTodo(true);
    try {
      const result = await addGroupTodo(selectedConversation.id, taskText);
      if (!result) {
        toast.error('Unable to add task right now.');
        return;
      }
      setTodoInput('');
      toast.success('Task added to group.');
    } catch (error) {
      console.error('Failed to add task:', error);
      toast.error('Failed to add task.');
    } finally {
      setIsAddingTodo(false);
    }
  }, [todoInput, selectedConversation?.id]);

  const formatTime = (timestamp: Date | null) => {
    if (!timestamp) return '';
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days === 1) return 'Yesterday';
    return timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const formatChatTimestamp = (timestamp: Date) =>
    timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const formatLastActive = (timestamp: Date | null) => {
    if (!timestamp) return null;
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60 * 60));
    if (diffHours < 24) return 'Recently active';
    return null;
  };

  const selectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setSurface('messages');
    if (conversation.isGroup) {
      markGroupNotificationsAsRead(conversation.id).catch(() => {});
    } else {
      // Use chatService's markAsSeen (batch + local cache update)
      markAsSeen(conversation.id);
    }
    setConversations((prev) =>
      prev.map((item) => (item.id === conversation.id ? { ...item, unreadCount: 0 } : item))
    );
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      if (!(isFirebaseConfigured && auth.currentUser)) {
        alert('Please sign in to send messages.');
        return;
      }

      let contentToSend = newMessage;
      const otherId = selectedConversation.participant.id;
      if (sharedKeys[otherId]) {
        contentToSend = await encryptMessage(newMessage, sharedKeys[otherId]);
      }

      const plainText = newMessage;
      setNewMessage('');
      const replyData = replyingTo ? {
        id: replyingTo.id,
        text: replyingTo.text,
        senderName: replyingTo.senderId === myId ? 'You' : getUserLabel(replyingTo.senderId)
      } : null;
      setReplyingTo(null);
      clearTypingStatus(selectedConversation.id);
      isNearBottomRef.current = true;

      // chatService handles optimistic insert + Firestore write + retry
      await sendMessageOptimistic(
        selectedConversation.id,
        plainText,
        contentToSend,
        chatUpdateRef.current || (() => {}),
        !!selectedConversation.isGroup,
        replyData
      );
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // Load more messages on scroll to top
  const handleLoadMore = useCallback(async () => {
    if (!selectedConversation || loadingMore || !canLoadMore) return;
    setLoadingMore(true);
    try {
      const scrollEl = messagesContainerRef.current;
      const prevHeight = scrollEl?.scrollHeight || 0;

      await loadMoreMessages(selectedConversation.id, !!selectedConversation.isGroup);
      setCanLoadMore(hasMoreMessages(selectedConversation.id));

      // Restore scroll position after prepending older messages
      requestAnimationFrame(() => {
        if (scrollEl) {
          scrollEl.scrollTop = scrollEl.scrollHeight - prevHeight;
        }
      });
    } finally {
      setLoadingMore(false);
    }
  }, [selectedConversation?.id, loadingMore, canLoadMore]);

  // Retry a failed message
  const handleRetryMessage = useCallback((messageId: string) => {
    if (!selectedConversation) return;
    retryMessage(selectedConversation.id, messageId, chatUpdateRef.current || (() => {}));
  }, [selectedConversation?.id]);

  const handleAcceptRequest = async (request: FriendRequest) => {
    if (!request.id || !request.senderId) return;
    setProcessingRequests((prev) => new Set(prev).add(request.id!));
    try {
      const result = await acceptFriendRequest(request.id, request.senderId);
      if (result && typeof result === 'object' && 'success' in result && result.success) {
        setSurface('messages');
      }
    } finally {
      setProcessingRequests((prev) => {
        const next = new Set(prev);
        next.delete(request.id!);
        return next;
      });
    }
  };

  const handleIgnoreRequest = async (request: FriendRequest) => {
    if (!request.id) return;
    setProcessingRequests((prev) => new Set(prev).add(request.id!));
    try {
      await ignoreFriendRequest(request.id);
    } finally {
      setProcessingRequests((prev) => {
        const next = new Set(prev);
        next.delete(request.id!);
        return next;
      });
    }
  };

  const openFriendProfile = async (friendUid: string) => {
    try {
      if (!onOpenProfile || !friendUid) return;
      const enhanced = await getEnhancedFriendProfile(friendUid);
      let profileDoc: any = null;
      try {
        profileDoc = await getProfile(friendUid);
      } catch {}
      onOpenProfile({
        id: friendUid,
        name: profileDoc?.name || enhanced?.displayName || 'User',
        major: profileDoc?.major ?? enhanced?.major,
        year: profileDoc?.year ?? enhanced?.year,
        university: profileDoc?.university ?? enhanced?.university,
        email: enhanced?.email,
        bio: profileDoc?.bio ?? enhanced?.bio,
        interests: profileDoc?.interests ?? enhanced?.interests,
        clubs: profileDoc?.clubs ?? enhanced?.clubs,
        timetable: enhanced?.timetable,
        sharedCourses: enhanced?.sharedCourses,
      });
    } catch (error) {
      console.warn('Failed to open friend profile', error);
    }
  };

  const handleStartChat = async (friendUid: string) => {
    try {
      const conversationId = await createConversation(friendUid);
      setShowComposer(false);
      setFriendSearch('');
      setSurface('messages');

      if (!conversationId) return;
      const existing = conversations.find((conversation) => conversation.id === conversationId);
      if (existing) {
        selectConversation(existing);
      }
    } catch (error) {
      console.error('Failed to start chat:', error);
    }
  };

  const currentUserInitial = (currentUser.name || currentUser.displayName || 'U').charAt(0).toUpperCase();

  if (loading) {
    return <MessagesSkeleton />;
  }

  return (
    <div className="h-full w-full flex flex-col bg-background text-on-surface overflow-hidden">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/60 bg-slate-50/75 px-4 shadow-sm backdrop-blur-xl md:px-6">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 shadow-sm border border-slate-100">
            <AvatarImage src={(currentUser as any).photoURL || auth?.currentUser?.photoURL || undefined} className="object-cover" />
            <AvatarFallback className="bg-sky-100 text-sky-700 text-sm font-bold">
              {currentUserInitial}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-['Plus_Jakarta_Sans'] text-xl font-bold tracking-tight text-sky-600">UniNest</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setSortBy(prev => prev === 'recent' ? 'unread' : 'recent')}
            className={`rounded-xl p-2 transition hover:bg-sky-50/80 ${sortBy === 'unread' ? 'text-sky-700 bg-sky-100' : 'text-sky-500'}`} 
            aria-label="Sort">
            <ArrowDownUp className="h-5 w-5" />
          </button>
          <button 
            onClick={() => setSurface(prev => prev === 'messages' ? 'requests' : 'messages')}
            className={`relative rounded-xl p-2 transition hover:bg-sky-50/80 ${surface === 'requests' ? 'text-sky-700 bg-sky-100' : 'text-sky-500'}`} 
            aria-label="Friends">
            <Users className="h-5 w-5" />
            {totalPendingRequests > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />}
          </button>
          <button 
            className={`relative rounded-xl p-2 transition hover:bg-sky-50/80 ${surface === 'notifications' ? 'text-sky-700 bg-sky-100' : 'text-sky-500'}`} 
            aria-label="Notifications"
            onClick={() => setSurface(prev => prev === 'messages' ? 'notifications' : 'messages')}
          >
            <Bell className="h-5 w-5" />
            {unreadNotificationCount > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />}
          </button>
        </div>
      </header>

      <main className="flex-1 w-full grid gap-0 lg:grid-cols-[380px_minmax(0,1fr)] overflow-hidden">
        <section className={`${selectedConversation ? 'hidden lg:block' : 'block'} border-r border-slate-200/60 bg-background overflow-y-auto h-full no-scrollbar`}>
          <div className="px-0 pb-32 pt-6">
            <div className="mb-8 flex items-center gap-3 px-4">
              <div className="flex flex-1 items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => setSurface((prev) => (prev === 'messages' ? (surface === 'notifications' ? 'messages' : 'requests') : 'messages'))}
                className="rounded-2xl bg-slate-100 p-3 text-sky-700"
                aria-label="Toggle inbox surface"
              >
                <SlidersHorizontal className="h-5 w-5" />
              </button>
            </div>

            <section className="mb-6 overflow-x-auto pb-2 no-scrollbar px-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Your Groups</h3>
                <button
                  type="button"
                  onClick={() => onNavigate?.('studygroups')}
                  className="text-xs font-bold text-sky-600 hover:text-sky-700 transition-colors"
                >
                  Explore All ↗
                </button>
              </div>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => onNavigate?.('studygroups')}
                  className="flex shrink-0 flex-col items-center gap-2"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-sky-500 bg-white hover:bg-sky-50 transition-colors">
                    <UserPlus className="h-5 w-5 text-sky-600" />
                  </div>
                  <span className="text-[11px] font-semibold tracking-wide text-slate-500">Create Group</span>
                </button>

                {studyGroups.filter(g => g.members.includes(myId)).map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onTouchStart={() => startGroupLongPress(group)}
                    onTouchEnd={clearGroupLongPress}
                    onTouchCancel={clearGroupLongPress}
                    onTouchMove={clearGroupLongPress}
                    onMouseDown={() => startGroupLongPress(group)}
                    onMouseUp={clearGroupLongPress}
                    onMouseLeave={clearGroupLongPress}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setGroupOptionsTarget(group);
                    }}
                    onClick={() => {
                      if (suppressNextGroupClickRef.current === group.id) {
                        suppressNextGroupClickRef.current = null;
                        return;
                      }
                      const groupConv: Conversation = {
                        id: group.id || '',
                        isGroup: true,
                        participant: {
                          id: group.id || '',
                          name: group.name,
                          avatar: null,
                          online: false,
                          lastSeen: null,
                        },
                        lastMessage: { text: '', timestamp: new Date(), senderId: '' },
                        unreadCount: 0,
                        messages: []
                      };
                      selectConversation(groupConv);
                    }}
                    className="flex shrink-0 flex-col items-center gap-2"
                  >
                    <div className="relative h-16 w-16 rounded-full bg-gradient-to-tr from-sky-400 to-sky-600 p-[2px]">
                      <div className="h-full w-full overflow-hidden rounded-full border-2 border-white bg-white">
                        <div className="flex h-full w-full items-center justify-center bg-sky-100 text-sm font-bold text-sky-700">
                          {group.name.substring(0, 2).toUpperCase()}
                        </div>
                      </div>
                      {hasUnreadGroup(group.id || '') && (
                        <span className="absolute -top-0.5 -right-0.5 block h-3.5 w-3.5 rounded-full bg-rose-500 ring-2 ring-white z-10 animate-pulse" />
                      )}
                    </div>
                    <span className="max-w-16 truncate text-[11px] font-semibold tracking-wide text-slate-500">
                      {group.name}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <div className="mb-3 flex items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <h2 className="ml-1 text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
                  {surface === 'messages' ? 'Recent Messages' : surface === 'requests' ? 'Requests' : 'Notifications'}
                </h2>
              </div>
            </div>

            {surface === 'messages' ? (
              <div className="divide-y divide-slate-100/50">
                {loading ? (
                  <EmptyState title="Loading conversations..." subtitle="Syncing your live inbox." />
                ) : filteredConversations.length === 0 ? (
                  <EmptyState title="No conversations yet" subtitle="Start a new chat with a friend to see it here." />
                ) : (
                  filteredConversations.map((conversation) => (
                    <div key={conversation.id} className="relative overflow-hidden">
                      {!conversation.isGroup && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConversationDelete(conversation).catch(() => {});
                          }}
                          disabled={deletingConversationIds.has(conversation.id)}
                          className="absolute inset-y-0 right-0 flex w-20 sm:w-24 items-center justify-center bg-rose-500 text-[11px] sm:text-xs font-bold tracking-wide text-white active:bg-rose-600 disabled:opacity-80"
                        >
                          {deletingConversationIds.has(conversation.id) ? 'Deleting' : 'Delete'}
                        </button>
                      )}
                      <button
                        type="button"
                        onTouchStart={(e) => beginConversationSwipe(conversation.id, e.touches[0]?.clientX || 0)}
                        onTouchMove={(e) => moveConversationSwipe(conversation.id, e.touches[0]?.clientX || 0)}
                        onTouchEnd={() => endConversationSwipe(conversation)}
                        onTouchCancel={() => clearConversationSwipe(conversation.id)}
                        onClick={() => {
                          if (suppressNextConversationClickRef.current === conversation.id) {
                            suppressNextConversationClickRef.current = null;
                            return;
                          }
                          selectConversation(conversation);
                        }}
                        style={{ transform: `translateX(${conversationSwipeOffsets[conversation.id] || 0}px)` }}
                        className="group relative z-10 flex w-full items-center gap-3 bg-white p-4 text-left transition-all duration-300 hover:bg-slate-100/80"
                      >
                      <div className="relative shrink-0">
                        <div className="h-12 w-12 overflow-hidden rounded-full bg-sky-100">
                          {conversation.participant.avatar ? (
                            <img
                              src={conversation.participant.avatar}
                              alt={conversation.participant.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-bold text-sky-700">
                              {conversation.participant.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div
                          className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background ${
                            conversation.participant.online ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex items-baseline justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <h3 className="truncate text-sm font-bold text-slate-900">{conversation.participant.name}</h3>
                            {sharedKeys[conversation.participant.id] && (
                              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {/* Hangout indicators */}
                            {(() => {
                              const pendingFrom = getPendingHangoutFromFriend(conversation.participant.id);
                              const pendingTo = getPendingHangoutToFriend(conversation.participant.id);
                              const acceptedH = getAcceptedHangoutForFriend(conversation.participant.id);
                              if (pendingFrom) {
                                return (
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => { e.stopPropagation(); setSelectedHangoutAction(pendingFrom); }}
                                    className="flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-600 hover:bg-amber-100 transition animate-bounce cursor-pointer"
                                    title="Pending hangout — tap to respond"
                                  >
                                    <PartyPopper className="h-3.5 w-3.5" />
                                  </div>
                                );
                              }
                              if (pendingTo) {
                                return (
                                  <span className="flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-600" title={`Invited to: ${pendingTo.title}`}>
                                    <PartyPopper className="h-3 w-3" />
                                    Invited
                                  </span>
                                );
                              }
                              if (acceptedH) {
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedHangoutAction(acceptedH);
                                    }}
                                    className="flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 hover:bg-emerald-100 transition"
                                    title={`Hangout: ${acceptedH.title}`}
                                  >
                                    <PartyPopper className="h-3 w-3" />
                                    {getHangoutTimeLeft(acceptedH)}
                                  </button>
                                );
                              }
                              return null;
                            })()}
                            <span className={`shrink-0 text-[10px] ${conversation.unreadCount > 0 ? 'font-bold text-sky-700' : 'font-medium text-slate-400'}`}>
                              {formatTime(conversation.lastMessage.timestamp)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className={`truncate pr-2 text-xs ${conversation.unreadCount > 0 ? 'font-semibold text-slate-800' : 'font-medium text-slate-500'}`}>
                            {conversation.lastMessage.senderId === myId ? 'You: ' : ''}
                            {conversation.lastMessage.text}
                          </p>
                          {conversation.unreadCount > 0 ? (
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sky-600 text-[9px] font-bold text-white">
                              {conversation.unreadCount}
                            </span>
                          ) : conversation.lastMessage.senderId === myId ? (
                            <CheckCheck className="h-4 w-4 text-sky-600/60" />
                          ) : null}
                        </div>
                        {!conversation.participant.online && formatLastActive(conversation.participant.lastSeen) && (
                          <p className="mt-0.5 text-[10px] text-slate-400">{formatLastActive(conversation.participant.lastSeen)}</p>
                        )}
                      </div>
                      </button>
                    </div>
                  ))
                )}
              </div>
            ) : surface === 'requests' ? (
              <div className="space-y-2">
                {requestsLoading ? (
                  <EmptyState title="Loading requests..." subtitle="Checking who wants to connect." />
                ) : friendRequests.length === 0 ? (
                  <EmptyState title="No pending requests" subtitle="When someone sends you a request, it will show up here." />
                ) : (
                  friendRequests.map((request) => (
                    <div key={request.id} className="rounded-2xl bg-white p-3 shadow-sm border border-slate-100">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarImage src={(request as any).senderPhotoURL || (request as any).photoURL} className="object-cover" />
                          <AvatarFallback>{(request.senderName || 'U').charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="truncate text-sm font-semibold text-slate-900">{request.senderName || 'Friend Request'}</h4>
                            <span className="text-[10px] text-slate-400 shrink-0">{request.createdAt?.toDate ? formatTime(request.createdAt.toDate()) : ''}</span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">Wants to connect with you.</p>
                          <div className="mt-2 flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleAcceptRequest(request)}
                              disabled={processingRequests.has(request.id || '')}
                              className="h-8 rounded-full bg-sky-600 px-4 text-xs font-bold text-white hover:bg-sky-700"
                            >
                              {processingRequests.has(request.id || '') ? 'Processing...' : 'Accept'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleIgnoreRequest(request)}
                              disabled={processingRequests.has(request.id || '')}
                              className="h-8 rounded-full px-4 text-xs font-bold"
                            >
                              Ignore
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {studyGroups.filter(g => g.createdBy === auth.currentUser?.uid && g.joinRequests && g.joinRequests.length > 0).map((group) => (
                  <div key={group.id} className="mt-6">
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Study Group: {group.name}</h3>
                    <div className="space-y-2">
                      {group.joinRequests!.map((requesterId) => (
                         <StudyGroupRequestItem key={requesterId} groupId={group.id!} requesterId={requesterId} />
                      ))}
                    </div>
                  </div>
                ))}

                {myPulses.filter(p => p.joinRequests && p.joinRequests.length > 0).map((pulse) => (
                  <div key={pulse.id || pulse.createdBy} className="mt-6">
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Pulse: {pulse.text}</h3>
                    <div className="space-y-2">
                      {pulse.joinRequests!.map((requesterId) => (
                        <PulseRequestItem 
                          key={requesterId} 
                          pulseId={pulse.id || pulse.createdBy} 
                          requesterId={requesterId} 
                          pulseText={pulse.text}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {/* HANGOUT REQUESTS */}
                {hangouts.filter(h => h.status === 'pending' && h.invitedFriends.includes(myId)).map((hangout) => {
                  return (
                    <div key={hangout.id} className="mt-6 rounded-2xl bg-white p-3 shadow-sm border border-slate-100">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                           🎉
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate text-sm font-semibold text-slate-900">{hangout.title}</h4>
                          <p className="mt-0.5 text-xs text-slate-500">
                             <strong>{hangout.category}</strong> at {hangout.location} <br/> {hangout.date} @ {hangout.time}
                          </p>
                          <div className="mt-2 flex gap-2">
                            <Button
                              size="sm"
                              onClick={async () => {
                                setProcessingRequests(prev => new Set(prev).add(`hangout-${hangout.id}`));
                                const success = await acceptHangout(hangout.id!);
                                setProcessingRequests(prev => { const s = new Set(prev); s.delete(`hangout-${hangout.id}`); return s; });
                                if (success) {
                                  toast.success('Hangout accepted!');
                                  // Force immediate UI update for this hangout
                                  setHangouts(prev => prev.map(h => 
                                    h.id === hangout.id 
                                      ? { 
                                          ...h, 
                                          acceptedFriends: [...(h.acceptedFriends || []), myId],
                                          invitedFriends: h.invitedFriends.filter(id => id !== myId)
                                        } 
                                      : h
                                  ));
                                } else {
                                  toast.error('Failed to accept hangout');
                                }
                              }}
                              disabled={processingRequests.has(`hangout-${hangout.id}`)}
                              className="h-8 rounded-full bg-sky-600 px-4 text-xs font-bold text-white hover:bg-sky-700"
                            >
                              {processingRequests.has(`hangout-${hangout.id}`) ? '...' : 'Accept'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                setProcessingRequests(prev => new Set(prev).add(`hangout-${hangout.id}`));
                                const success = await rejectHangout(hangout.id!);
                                setProcessingRequests(prev => { const s = new Set(prev); s.delete(`hangout-${hangout.id}`); return s; });
                                if (success) {
                                  toast.success('Hangout declined');
                                  // Force immediate UI update to hide this hangout
                                  setHangouts(prev => prev.map(h => 
                                    h.id === hangout.id 
                                      ? { ...h, invitedFriends: h.invitedFriends.filter(id => id !== myId) } 
                                      : h
                                  ));
                                } else {
                                  toast.error('Failed to decline hangout');
                                }
                              }}
                              disabled={processingRequests.has(`hangout-${hangout.id}`)}
                              className="h-8 rounded-full px-4 text-xs font-bold"
                            >
                              Decline
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            ) : (
              <div className="space-y-2">
                {notifications.length === 0 ? (
                  <EmptyState title="No notifications" subtitle="You're all caught up!" />
                ) : (
                  notifications.map((notif) => (
                    <div key={notif.id} className={`p-3 rounded-2xl border shadow-sm flex gap-3 ${notif.category === 'admin' ? 'bg-white/60 border-white/60' : 'bg-sky-50/50 border-sky-100'}`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${notif.category === 'admin' ? 'bg-sky-100' : 'bg-white shadow-sm'}`}>
                        {notif.type === 'event' ? <Calendar className="w-5 h-5 text-sky-600" /> : <Bell className="w-5 h-5 text-sky-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-bold text-slate-800">{notif.title}</h4>
                          {notif.category === 'user' && !notif.read && <span className="h-1.5 w-1.5 rounded-full bg-sky-600" />}
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{notif.message}</p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {notif.createdAt?.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </section>

        <section className={`${selectedConversation ? 'fixed inset-0 z-[100] bg-white' : 'hidden'} lg:relative lg:z-auto lg:block bg-white/50`}>
          {selectedConversation ? (
            <div className="flex h-[100dvh] flex-col lg:h-[calc(100dvh-5rem)]">
              <div className="flex items-center gap-3 border-b border-slate-200/60 bg-white/70 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 backdrop-blur-xl md:px-6 md:pt-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 lg:hidden"
                  onClick={() => setSelectedConversation(null)}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    if (!selectedConversation.isGroup) {
                      openFriendProfile(selectedConversation.participant.id);
                    }
                  }}
                  className="relative"
                >
                  <Avatar className="h-10 w-10">
                    {selectedConversation.isGroup ? (
                      <div className="flex h-full w-full items-center justify-center bg-sky-100 text-sky-700 font-bold">
                        {selectedConversation.participant.name.substring(0, 2).toUpperCase()}
                      </div>
                    ) : (
                      <>
                        <AvatarImage src={selectedConversation.participant.avatar || undefined} className="object-cover" />
                        <AvatarFallback>{selectedConversation.participant.name.charAt(0)}</AvatarFallback>
                      </>
                    )}
                  </Avatar>
                  {selectedConversation.participant.online && !selectedConversation.isGroup && (
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                  )}
                </button>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-bold text-slate-900">{selectedConversation.participant.name}</h3>
                    {sharedKeys[selectedConversation.participant.id] && (
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    )}
                    {(() => {
                      const pendingFrom = getPendingHangoutFromFriend(selectedConversation.participant.id);
                      const pendingTo = getPendingHangoutToFriend(selectedConversation.participant.id);
                      const acceptedH = getAcceptedHangoutForFriend(selectedConversation.participant.id);
                      if (pendingFrom) {
                        return (
                          <button
                            type="button"
                            onClick={() => setSelectedHangoutAction(pendingFrom)}
                            className="flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-amber-600 hover:bg-amber-100 transition animate-bounce shadow-sm"
                            title="Pending hangout — tap to respond"
                          >
                            <PartyPopper className="h-3.5 w-3.5" />
                            <span className="text-[10px] font-bold">Accept?</span>
                          </button>
                        );
                      }
                      if (pendingTo) {
                        return (
                          <span className="flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600 shadow-sm" title={`Invited to: ${pendingTo.title}`}>
                            <PartyPopper className="h-3 w-3" />
                            Invited
                          </span>
                        );
                      }
                      if (acceptedH) {
                        return (
                          <button
                            type="button"
                            onClick={() => setSelectedHangoutAction(acceptedH)}
                            className="flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 shadow-sm hover:bg-emerald-100 transition"
                            title={`Hangout: ${acceptedH.title}`}
                          >
                            <PartyPopper className="h-3 w-3" />
                            {getHangoutTimeLeft(acceptedH)}
                          </button>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <p className="text-xs text-slate-500">
                    {selectedConversation && !selectedConversation.isGroup && isUserTyping(typingState, selectedConversation.participant.id)
                      ? <span className="text-sky-500 font-medium animate-pulse">typing...</span>
                      : selectedConversation.isGroup
                         ? `${activeStudyGroup?.members?.length || 0} members`
                        : selectedConversation.participant.online
                          ? 'Online now'
                          : formatLastActive(selectedConversation.participant.lastSeen) || 'Offline'}
                  </p>
                </div>

                {selectedConversation.isGroup && (
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFocusTimerMode('stopwatch');
                        setStudyToolTab('focus');
                        setShowStudyTools(true);
                      }}
                      className="h-9 rounded-full bg-sky-50 text-sky-600 hover:bg-sky-100 hover:text-sky-700 px-3 flex items-center gap-2"
                    >
                      <LayoutGrid className="h-4 w-4" />
                      <span className="hidden sm:inline font-bold text-xs uppercase tracking-wider">Tools</span>
                    </Button>
                  </div>
                )}

                {(() => {
                  const participantId = selectedConversation.participant.id;
                  const activeHangout = hangouts.find(h => 
                    h.status !== 'completed' &&
                    (
                      (h.creatorId === myId && h.acceptedFriends?.includes(participantId)) ||
                      (h.creatorId === participantId && h.acceptedFriends?.includes(myId)) ||
                      (h.acceptedFriends?.includes(myId) && h.acceptedFriends?.includes(participantId))
                    )
                  );
                  
                  if (!activeHangout) return null;
                  
                  const hangoutDate = new Date(`${activeHangout.date}T${activeHangout.time}`);
                  const now = new Date();
                  const diffMs = hangoutDate.getTime() - now.getTime();
                  
                  if (diffMs < 0) return null; // Past
                  
                  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                  
                  let countdownText = '';
                  if (diffDays > 0) {
                    countdownText = `in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
                  } else {
                    countdownText = `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
                  }

                  return (
                    <div className="ml-auto flex items-center justify-center group relative cursor-help">
                       <div className="flex items-center justify-center h-9 w-9 bg-sky-50 rounded-full text-sky-600 shadow-sm border border-sky-200 transition-transform group-hover:scale-105">
                         🎉
                       </div>
                       <div className="absolute top-full right-0 mt-2 bg-white p-3 rounded-2xl shadow-xl border border-slate-100/50 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                          <p className="text-xs font-bold text-slate-800">{activeHangout.title}</p>
                          <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">📍 {activeHangout.location}</p>
                          <div className="mt-2 inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                             {countdownText}
                          </div>
                       </div>
                    </div>
                  );
                })()}
              </div>

              <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(125,211,252,0.12),_transparent_24%),linear-gradient(180deg,_rgba(241,247,251,0.7),_rgba(255,255,255,0.92))] px-4 py-4 md:px-6"
                onScroll={(e) => {
                  handleMessagesScroll();
                  const el = e.currentTarget;
                  if (el.scrollTop < 60 && canLoadMore && !loadingMore) {
                    handleLoadMore();
                  }
                }}
              >
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
                  {/* Load more button */}
                  {canLoadMore && selectedConversation.messages.length >= 30 && (
                    <div className="flex justify-center py-2">
                      <button
                        type="button"
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200/60 transition hover:bg-white active:scale-95 disabled:opacity-50"
                      >
                        {loadingMore ? (
                          <><Loader2 className="h-3 w-3 animate-spin" /> Loading...</>
                        ) : (
                          <><ChevronUp className="h-3 w-3" /> Load earlier messages</>
                        )}
                      </button>
                    </div>
                  )}

                  {selectedConversation.messages.length === 0 ? (
                    <EmptyState title="No messages yet" subtitle="Say hi and start the conversation." compact />
                  ) : (
                    selectedConversation.messages.map((message) => {
                      const isMine = message.senderId === myId;
                      const status = message.status;

                      return (
                        <div
                          key={message.id}
                          id={`msg-${message.id}`}
                          className={`group flex w-full items-center gap-2 transition-all duration-300 ${isMine ? 'justify-end' : 'justify-start'}`}
                        >
                          {isMine && (
                            <button
                              onClick={() => setReplyingTo(message)}
                              className="opacity-40 md:opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-slate-400 hover:text-sky-600 rounded-full hover:bg-slate-100/80"
                              title="Reply"
                            >
                              <CornerUpLeft className="h-4 w-4" />
                            </button>
                          )}
                          {!isMine && (
                            <Avatar className="h-8 w-8 self-end mb-1 shrink-0 shadow-sm border border-white">
                               <AvatarImage src={selectedConversation.isGroup ? friends.find(f => f.uid === message.senderId)?.photoURL : selectedConversation.participant.avatar || undefined} className="object-cover" />
                               <AvatarFallback className="bg-sky-100 text-sky-700 text-[10px] font-bold">
                                 {getUserLabel(message.senderId).charAt(0)}
                               </AvatarFallback>
                            </Avatar>
                          )}
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm transition-colors duration-300 ${
                              isMine
                                ? `rounded-tr-md bg-gradient-to-tr from-sky-700 to-sky-400 text-white ${status === 'failed' ? 'opacity-60 ring-2 ring-red-400' : ''}`
                                : 'rounded-tl-md bg-white text-slate-800 ring-1 ring-slate-200/70'
                            }`}
                          >
                            {selectedConversation.isGroup && !isMine && (
                              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-sky-600">
                                {getUserLabel(message.senderId)}
                              </p>
                            )}
                            {message.replyTo && (
                              <div
                                onClick={() => {
                                  const targetEl = document.getElementById(`msg-${message.replyTo?.id}`);
                                  if (targetEl) {
                                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    targetEl.classList.add('bg-sky-400/10', 'ring-2', 'ring-sky-400', 'rounded-2xl', 'p-1');
                                    setTimeout(() => {
                                      targetEl.classList.remove('bg-sky-400/10', 'ring-2', 'ring-sky-400', 'rounded-2xl', 'p-1');
                                    }, 1500);
                                  }
                                }}
                                className={`mb-1.5 border-l-2 pl-2 text-xs py-1 rounded cursor-pointer select-none transition ${
                                  isMine
                                    ? 'border-white/50 bg-white/10 text-white/90 hover:bg-white/20'
                                    : 'border-sky-500 bg-sky-50/70 text-slate-600 hover:bg-sky-100/60'
                                }`}
                              >
                                <p className="font-bold text-[10px] opacity-90">{message.replyTo.senderName}</p>
                                <p className="truncate max-w-[200px] text-xs mt-0.5">{message.replyTo.text}</p>
                              </div>
                            )}
                            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.text}</p>
                            <div className={`mt-0.5 flex items-center gap-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                              <span className={`text-[10px] ${isMine ? 'text-white/70' : 'text-slate-400'}`}>
                                {formatChatTimestamp(message.timestamp)}
                              </span>
                              {/* Read receipt indicators for sent messages */}
                              {isMine && (
                                <span className="inline-flex items-center">
                                  {status === 'sending' && (
                                    <Loader2 className="h-3 w-3 animate-spin text-white/50" />
                                  )}
                                  {status === 'sent' && (
                                    <Check className="h-3 w-3 text-white/60" />
                                  )}
                                  {(status === 'delivered' || status === 'seen') && (
                                    <CheckCheck className={`h-3 w-3 ${status === 'seen' ? 'text-sky-200' : 'text-white/60'}`} />
                                  )}
                                  {status === 'failed' && (
                                    <button
                                      type="button"
                                      onClick={() => handleRetryMessage(message.id)}
                                      className="ml-1 inline-flex items-center gap-0.5 text-red-200 hover:text-white transition"
                                      title="Tap to retry"
                                    >
                                      <AlertCircle className="h-3 w-3" />
                                      <span className="text-[9px] font-bold">Retry</span>
                                    </button>
                                  )}
                                  {!status && (
                                    <Check className="h-3 w-3 text-white/60" />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                          {!isMine && (
                            <button
                              onClick={() => setReplyingTo(message)}
                              className="opacity-40 md:opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-slate-400 hover:text-sky-600 rounded-full hover:bg-slate-100/80"
                              title="Reply"
                            >
                              <CornerUpLeft className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}

                  {/* Typing indicator */}
                  {selectedConversation && isUserTyping(typingState, selectedConversation.participant.id) && (
                    <div className="flex justify-start">
                      <div className="rounded-2xl rounded-tl-md bg-white px-4 py-3 text-slate-500 ring-1 ring-slate-200/70 shadow-sm">
                        <div className="flex items-center gap-1">
                          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0ms' }} />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '150ms' }} />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </div>

              <div className="border-t border-slate-200/60 bg-white/85 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-xl md:px-6 md:pb-3">
                <div className="mx-auto w-full max-w-3xl">
                  {replyingTo && (
                    <div className="mb-2.5 flex items-center justify-between rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-2.5 text-xs animate-in fade-in slide-in-from-bottom-2 duration-200">
                      <div className="border-l-2 border-sky-500 pl-2.5 min-w-0">
                        <p className="font-bold text-sky-600">
                          Replying to {replyingTo.senderId === myId ? 'yourself' : getUserLabel(replyingTo.senderId)}
                        </p>
                        <p className="text-slate-500 truncate max-w-[260px] md:max-w-lg mt-0.5">{replyingTo.text}</p>
                      </div>
                      <button
                        onClick={() => setReplyingTo(null)}
                        className="rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {!selectedConversation.isGroup && sharedKeys[selectedConversation.participant.id] && (
                    <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-medium text-emerald-700">
                      <ShieldCheck className="h-3 w-3" />
                      End-to-end encrypted
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        if (selectedConversation && e.target.value.trim()) {
                          sendTypingStatus(selectedConversation.id);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="h-11 flex-1 rounded-full border-slate-200 bg-slate-50 pl-4"
                    />
                    <Button
                      onClick={handleSendMessage}
                      className="h-11 w-11 shrink-0 rounded-2xl bg-gradient-to-tr from-sky-700 to-sky-400 p-0 text-white"
                    >
                      <MessageCircle className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="hidden h-full items-center justify-center lg:flex">
              <EmptyState title="Choose a conversation" subtitle="Your live chats will open here." compact />
            </div>
          )}
        </section>
      </main>

      {!selectedConversation && (
        <button
          type="button"
          onClick={() => setShowComposer(true)}
          className="fixed bottom-28 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-700 to-sky-400 text-white shadow-xl transition active:scale-90 md:bottom-6"
          aria-label="Compose"
        >
          <Edit3 className="h-5 w-5" />
        </button>
      )}

      {showComposer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/30 p-4 backdrop-blur-[2px] sm:items-center">
          <div className="w-full max-w-md rounded-[2rem] bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-slate-900">Start a conversation</h3>
                <p className="text-sm text-slate-500">Search your real friend list and jump straight into chat.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowComposer(false);
                  setFriendSearch('');
                }}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                placeholder="Search friends..."
                value={friendSearch}
                onChange={(e) => setFriendSearch(e.target.value)}
              />
            </div>

            <div className="max-h-72 space-y-2 overflow-y-auto">
              {!friendSearch ? (
                <EmptyState title="Search by name" subtitle="Type to find a friend and open a real-time conversation." compact />
              ) : filteredFriends.length === 0 ? (
                <EmptyState title="No matching friends" subtitle="Try a different name." compact />
              ) : (
                filteredFriends.slice(0, 8).map((friend) => {
                  const resolvedName =
                      formatEmailToName(friendProfileNames[friend.uid] || friend.displayName || friend.email);

                  return (
                    <div key={friend.uid} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                      <Avatar className="h-11 w-11">
                        <AvatarImage src={(friend as any).photoURL} className="object-cover" />
                        <AvatarFallback>{resolvedName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => openFriendProfile(friend.uid)}
                      >
                        <p className="truncate font-semibold text-slate-900">{resolvedName}</p>
                        <p className="truncate text-sm text-slate-500">{friend.major || friend.email}</p>
                      </button>
                      <Button
                        size="sm"
                        onClick={() => handleStartChat(friend.uid)}
                        className="rounded-full bg-sky-600 text-white hover:bg-sky-700"
                      >
                        <UserPlus className="mr-1 h-3.5 w-3.5" />
                        Chat
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      <Dialog open={showStudyGroupModal} onOpenChange={setShowStudyGroupModal}>
        <DialogContent className="glass-panel border-white/50 p-6 rounded-3xl max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-slate-800">Create Study Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Study Topic</label>
              <Input value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} placeholder="e.g. Physics II Midterm Prep" className="bg-slate-50 border-slate-200" />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Invite a Friend (to check free time)</label>
              <select 
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                onChange={(e) => {
                  const friend = friends.find(f => f.uid === e.target.value);
                  setSelectedFriendForStudy(friend || null);
                }}
                value={selectedFriendForStudy?.uid || ''}
              >
                <option value="">Select a friend...</option>
                {friends.map(friend => (
                  <option key={friend.uid} value={friend.uid}>{friendProfileNames[friend.uid] || friend.name || 'User'}</option>
                ))}
              </select>
            </div>

            {selectedFriendForStudy && (
              <div className="p-4 bg-sky-50 rounded-2xl border border-sky-100">
                <p className="text-[10px] font-bold text-sky-600 uppercase mb-2">Common Free Slots</p>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {Object.entries(commonFreeSlots).some(([_, slots]) => slots.length > 0) ? (
                    Object.entries(commonFreeSlots).map(([day, slots]) => slots.length > 0 && (
                      <div key={day} className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400">{day}</p>
                        {slots.map((slot, i) => (
                          <button 
                            key={i}
                            onClick={() => setNewEvent({...newEvent, description: `Study session on ${day} at ${formatTimeLabel(slot.start)}`})}
                            className="w-full text-left px-3 py-1.5 bg-white rounded-lg text-xs hover:bg-sky-100 transition-colors border border-sky-200/50"
                          >
                            {formatTimeLabel(slot.start)} - {formatTimeLabel(slot.end)}
                          </button>
                        ))}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">No common free slots found</p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Details (Location/Time)</label>
              <Input value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} placeholder="e.g. Meet at Library 3rd Floor @ 4pm" className="bg-slate-50 border-slate-200" />
            </div>

            <Button 
              className="w-full h-11 bg-sky-500 hover:bg-sky-600 text-white rounded-xl shadow-lg mt-2 font-bold"
              onClick={async () => {
                if (!newEvent.title) return;
                const createdGroupId = await createStudyGroup({
                  name: newEvent.title,
                  description: newEvent.description,
                  course: "Study",
                  maxMembers: 10,
                  universityId: currentUser?.universityId || 'default',
                });
                if (!createdGroupId) {
                  toast.error('Unable to create study group right now.');
                  return;
                }

                if (selectedFriendForStudy?.uid) {
                  await inviteMembersToStudyGroup(createdGroupId, [selectedFriendForStudy.uid]);
                }

                const groupConv: Conversation = {
                  id: createdGroupId,
                  isGroup: true,
                  participant: {
                    id: createdGroupId,
                    name: newEvent.title,
                    avatar: null,
                    online: false,
                    lastSeen: null,
                  },
                  lastMessage: { text: '', timestamp: new Date(), senderId: '' },
                  unreadCount: 0,
                  messages: []
                };
                selectConversation(groupConv);
                setShowStudyGroupModal(false);
                setNewEvent({ title: '', description: '' });
                setSelectedFriendForStudy(null);
                if (onNavigate) {
                  onNavigate('studygroups');
                  toast.success('Study Group created successfully!');
                } else {
                  toast.success('Study Group created successfully! Visit the Study Groups tab to start chatting.');
                }
              }}
            >
              Create Group
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!groupOptionsTarget} onOpenChange={(open) => !open && setGroupOptionsTarget(null)}>
        <DialogContent className="max-w-sm rounded-3xl border-slate-200 bg-white p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">Study Group Options</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500">
            {groupOptionsTarget?.name || 'This group'}
          </p>
          {groupOptionsTarget?.createdBy === myId ? (
            <Button
              type="button"
              onClick={handleDeleteGroupFromOptions}
              disabled={deletingGroupId === groupOptionsTarget?.id}
              className="mt-3 h-10 w-full rounded-xl bg-rose-600 text-white hover:bg-rose-700"
            >
              {deletingGroupId === groupOptionsTarget?.id ? 'Deleting...' : 'Delete Study Group'}
            </Button>
          ) : (
            <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-medium text-slate-500">
              Only the group owner can delete this study group.
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => setGroupOptionsTarget(null)}
            className="mt-2 h-10 w-full rounded-xl"
          >
            Close
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={showStudyTools} onOpenChange={setShowStudyTools}>
        <DialogContent className="bg-white border-slate-200 !p-0 !flex !flex-col !gap-0 !max-w-none !max-h-none !w-full !h-full !rounded-none !border-0 !left-0 !top-0 !translate-x-0 !translate-y-0 sm:!max-w-2xl sm:!max-h-[90vh] sm:!w-full sm:!h-auto sm:!rounded-[2.5rem] sm:!border-2 sm:!left-[50%] sm:!top-[50%] sm:!translate-x-[-50%] sm:!translate-y-[-50%] overflow-hidden shadow-2xl pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:!pt-0 sm:!pb-0 [&>button]:!top-[calc(1rem+env(safe-area-inset-top))] sm:[&>button]:!top-4">
          <div className="flex border-b border-slate-200 bg-white shadow-sm shrink-0 pr-12 sm:pr-0">
            <button
              onClick={() => setStudyToolTab('focus')}
              className={`flex-1 py-4 text-xs font-bold uppercase tracking-[0.2em] transition-all ${studyToolTab === 'focus' ? 'text-sky-600 bg-sky-50/50 border-b-2 border-sky-500' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Focus & Tasks
            </button>
            <button
              onClick={() => {
                setStudyToolTab('invite');
                setActiveInviteTab('friends');
              }}
              className={`flex-1 py-4 text-xs font-bold uppercase tracking-[0.2em] transition-all ${studyToolTab === 'invite' ? 'text-sky-600 bg-sky-50/50 border-b-2 border-sky-500' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Invite People
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {studyToolTab === 'focus' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 min-h-0 md:min-h-full">
                {/* Left: Pomodoro */}
                <div className="p-3 sm:p-8 flex flex-col justify-center border-b md:border-b-0 md:border-r border-slate-100 bg-white">
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-slate-800">Study Focus</h3>
                    <p className="text-sm text-slate-500">
                      {focusTimerMode === 'stopwatch'
                        ? 'Track your session live with the stopwatch.'
                        : 'Stay productive with the Pomodoro technique.'}
                    </p>
                  </div>
                  <PomodoroTimer initialView={focusTimerMode} />
                  
                  <div className="mt-8 flex justify-center">
                    <Button
                      variant="outline"
                      onClick={() => setShowStudyTools(false)}
                      className="w-full sm:w-auto px-8 rounded-xl h-10 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                    >
                      Exit Timer
                    </Button>
                  </div>
                </div>

                {/* Right: Group Todo */}
                <div className="p-3 sm:p-8 flex flex-col bg-slate-50/50">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">Group Tasks</h3>
                      <p className="text-sm text-slate-500">Collaborative goals for the group.</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-sky-100 flex items-center justify-center text-sky-600">
                      <ListTodo className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="flex gap-2 mb-4">
                    <Input 
                      ref={todoInputRef}
                      placeholder="Add a task..." 
                      value={todoInput}
                      onChange={(e) => setTodoInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTask();
                        }
                      }}
                      className="rounded-full bg-white border-slate-200"
                    />
                    <Button 
                      onClick={handleAddTask}
                      type="button"
                      disabled={isAddingTodo}
                      className="rounded-full h-10 w-10 p-0 bg-sky-600 text-white"
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                  <p className="mb-3 text-[11px] font-medium text-slate-500">Anyone in this group can add and mark tasks.</p>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {groupTodos.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center opacity-40">
                        <ListTodo className="h-12 w-12 mb-2" />
                        <p className="text-xs font-bold uppercase tracking-widest">All Clear!</p>
                      </div>
                    ) : (
                      groupTodos.map((todo) => {
                        const markedUserIds = Array.from(new Set([
                          ...(todo.completedByUsers || []),
                          ...(todo.completed && todo.completedBy ? [todo.completedBy] : []),
                        ].filter(Boolean) as string[]));
                        const isMarkedByMe = markedUserIds.includes(myId);
                        const markedByText =
                          markedUserIds.length === 0
                            ? `Added by ${getUserLabel(todo.createdBy)}`
                            : `Marked by ${markedUserIds.map((uid) => getUserLabel(uid)).join(', ')}`;

                        return (
                          <div key={todo.id} className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm group">
                            <button
                              onClick={() => toggleGroupTodo(selectedConversation!.id, todo.id!, !isMarkedByMe)}
                              className={`h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all ${isMarkedByMe ? 'bg-sky-500 border-sky-500 text-white' : 'border-slate-200 hover:border-sky-400'}`}
                              title={isMarkedByMe ? 'Unmark for me' : 'Mark done for me'}
                            >
                              {isMarkedByMe && <Check className="h-4 w-4" />}
                            </button>
                            <span className={`flex-1 text-sm font-medium ${isMarkedByMe ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                              {todo.text}
                              <span className="block text-[10px] font-semibold mt-1 text-slate-400">
                                {markedByText}
                              </span>
                            </span>
                            <button
                              onClick={() => deleteGroupTodo(selectedConversation!.id, todo.id!)}
                              className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 sm:p-8 bg-white h-full flex flex-col">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">Invite People</h3>
                    <p className="text-sm text-slate-500">Add more students or friends to this study group.</p>
                  </div>
                  <Button variant="outline" size="sm" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-slate-200" onClick={handleLeaveStudyGroup}>
                    Leave Group
                  </Button>
                </div>

                <div className="relative mb-4 shrink-0">
                  <Input
                    placeholder="Search people..."
                    value={inviteSearchQuery}
                    onChange={(e) => setInviteSearchQuery(e.target.value)}
                    className="pl-10 h-10 rounded-xl border-slate-200 bg-slate-50 focus:bg-white"
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 text-sm">🔍</div>
                </div>

                <div className="flex bg-slate-100/50 p-1 rounded-xl mb-4 shrink-0 border border-slate-200/30">
                  <button
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeInviteTab === 'friends' ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-500 hover:text-slate-600'}`}
                    onClick={() => setActiveInviteTab('friends')}
                  >
                    My Friends
                  </button>
                  <button
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeInviteTab === 'discover' ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-500 hover:text-slate-600'}`}
                    onClick={() => {
                      setActiveInviteTab('discover');
                      if (selectedConversation?.id) {
                        preloadDiscoverable(selectedConversation.id);
                      }
                    }}
                  >
                    All Students
                  </button>
                </div>
                
                <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                  {activeInviteTab === 'friends' && (
                    friends.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <Users className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p>No friends found to invite.</p>
                      </div>
                    ) : invitableFriends.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <Users className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p>All your friends are already in this group.</p>
                      </div>
                    ) : (
                      (() => {
                        const filtered = invitableFriends.filter(f => (f.displayName || '').toLowerCase().includes(inviteSearchQuery.toLowerCase()));
                        if (filtered.length === 0) {
                          return (
                            <div className="text-center py-12 text-slate-400">
                              <p>No matching friends found.</p>
                            </div>
                          );
                        }
                        return filtered.map((friend) => (
                          <div key={friend.uid} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-sky-50 transition-colors">
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarImage src={(friend as any).photoURL} className="object-cover" />
                                <AvatarFallback className="bg-sky-100 text-sky-700 font-bold">{friend.displayName?.charAt(0) || 'U'}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-bold text-slate-800 text-sm">{friend.displayName || 'User'}</p>
                                <p className="text-xs text-slate-500">{friend.major || 'Student'}</p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={async () => {
                                setInvitingMembers((prev) => new Set(prev).add(friend.uid));
                                const ok = await inviteMembersToStudyGroup(selectedConversation!.id, [friend.uid]);
                                setInvitingMembers((prev) => {
                                  const next = new Set(prev);
                                  next.delete(friend.uid);
                                  return next;
                                });
                                if (ok) toast.success(`Invited ${friend.displayName || 'friend'}`);
                              }}
                              disabled={invitingMembers.has(friend.uid)}
                              className="rounded-full bg-sky-600 text-white h-8 px-4 text-xs font-bold"
                            >
                              {invitingMembers.has(friend.uid) ? 'Adding...' : 'Add to Group'}
                            </Button>
                          </div>
                        ));
                      })()
                    )
                  )}

                  {activeInviteTab === 'discover' && (
                    discoverableLoading ? (
                      <div className="text-center py-12 text-slate-400">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-sky-600" />
                        <p>Loading other students...</p>
                      </div>
                    ) : discoverableUsers.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <Users className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p>No other students found to invite.</p>
                      </div>
                    ) : (
                      (() => {
                        const filtered = discoverableUsers.filter(u => (u.displayName || '').toLowerCase().includes(inviteSearchQuery.toLowerCase()));
                        if (filtered.length === 0) {
                          return (
                            <div className="text-center py-12 text-slate-400">
                              <p>No matching students found.</p>
                            </div>
                          );
                        }
                        return filtered.map((user) => (
                          <div key={user.uid} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-sky-50 transition-colors">
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarImage src={(user as any).photoURL} className="object-cover" />
                                <AvatarFallback className="bg-sky-100 text-sky-700 font-bold">{user.displayName?.charAt(0) || 'U'}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-bold text-slate-800 text-sm">{user.displayName || 'User'}</p>
                                <p className="text-xs text-slate-500">{user.major || 'Student'}</p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={async () => {
                                setInvitingMembers((prev) => new Set(prev).add(user.uid));
                                const ok = await inviteMembersToStudyGroup(selectedConversation!.id, [user.uid]);
                                setInvitingMembers((prev) => {
                                  const next = new Set(prev);
                                  next.delete(user.uid);
                                  return next;
                                });
                                if (ok) {
                                  toast.success(`Added ${user.displayName || 'student'} to the group`);
                                  setDiscoverableUsers(prev => prev.filter(u => u.uid !== user.uid));
                                }
                              }}
                              disabled={invitingMembers.has(user.uid)}
                              className="rounded-full bg-sky-600 text-white h-8 px-4 text-xs font-bold"
                            >
                              {invitingMembers.has(user.uid) ? 'Adding...' : 'Add to Group'}
                            </Button>
                          </div>
                        ));
                      })()
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Hangout Accept/Reject Modal */}
      {selectedHangoutAction && (() => {
        const h = selectedHangoutAction;
        const timeLeft = getHangoutTimeLeft(h);
        const iAmCreator = h.creatorId === myId;
        const hasAccepted = h.acceptedFriends?.includes(myId);
        const canRespond = !iAmCreator && h.status === 'pending' && !hasAccepted;
        return (
          <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4" onClick={() => setSelectedHangoutAction(null)}>
            <div
              className="w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] bg-white shadow-2xl animate-in slide-in-from-bottom-8 sm:zoom-in duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="relative rounded-t-[32px] bg-gradient-to-br from-amber-400 to-orange-500 px-5 pt-4 pb-4 shrink-0">
                <button onClick={() => setSelectedHangoutAction(null)} className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/40 transition">
                  <X className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white">
                    <PartyPopper className="h-3 w-3" /> Hangout
                  </span>
                  {timeLeft && <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider">in {timeLeft}</span>}
                </div>
                <h3 className="pr-10 text-lg font-extrabold text-white leading-snug break-words line-clamp-2">"{h.title}"</h3>
                <p className="mt-0.5 text-xs font-semibold text-white/85">{h.category}</p>
              </div>

              {/* Info cards */}
              <div className="px-5 mt-3 space-y-3 pb-3 max-h-[40vh] overflow-y-auto no-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="flex items-start gap-2.5 rounded-2xl p-3 bg-amber-50 text-amber-700 border border-black/5">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Location</p>
                      <p className="text-sm font-extrabold break-words">{h.location || 'TBD'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 rounded-2xl p-3 bg-sky-50 text-sky-700 border border-black/5">
                    <Calendar className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">When</p>
                      <p className="text-sm font-extrabold break-words">{h.date ? new Date(h.date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'TBD'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 rounded-2xl p-3 bg-violet-50 text-violet-700 border border-black/5">
                    <Clock className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Time</p>
                      <p className="text-sm font-extrabold break-words">{h.time || 'TBD'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 rounded-2xl p-3 bg-emerald-50 text-emerald-700 border border-black/5">
                    <Users className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">People</p>
                      <p className="text-sm font-extrabold break-words">{(h.acceptedFriends?.length || 0) + 1} joined</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 px-5 pb-6 pt-1">
                {canRespond ? (
                  <>
                    <button
                      onClick={() => {
                        setSelectedHangoutAction(null);
                        toast('Hangout declined');
                        if (h.id) rejectHangout(h.id).catch(() => {});
                      }}
                      className="flex-1 rounded-2xl bg-slate-100 py-3.5 text-sm font-bold text-slate-600 transition hover:bg-slate-200 active:scale-95"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => {
                        setSelectedHangoutAction(null);
                        toast.success(`You're in for "${h.title}"!`);
                        if (h.id) acceptHangout(h.id).catch(() => {});
                      }}
                      className="flex-[1.5] rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-amber-200 transition hover:shadow-xl active:scale-95"
                    >
                      🎉 Accept
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setSelectedHangoutAction(null)}
                    className="flex-1 rounded-2xl bg-slate-100 py-3.5 text-sm font-bold text-slate-600 transition hover:bg-slate-200 active:scale-95"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function EmptyState({
  title,
  subtitle,
  compact = false,
}: {
  title: string;
  subtitle: string;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-8' : 'py-16'}`}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-600">
        <MessageCircle className="h-5 w-5" />
      </div>
      <p className="font-semibold text-slate-800">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function StudyGroupRequestItem({ groupId, requesterId }: { groupId: string, requesterId: string }) {
  const [requester, setRequester] = useState<any>(null);

  useEffect(() => {
    import('../../../utils/firebase/firestore').then(({ getProfile }) => {
      getProfile(requesterId).then(p => {
        if (p) setRequester(p);
      });
    });
  }, [requesterId]);

  if (!requester) return null;

  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm border border-slate-100">
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={(requester as any).photoURL || (requester as any).senderPhotoURL} className="object-cover" />
          <AvatarFallback>{(requester.name || 'U').charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-semibold text-slate-900">{requester.name}</h4>
          <p className="mt-0.5 text-xs text-slate-500">Wants to join your group</p>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                import('../../../utils/firebase/firestore').then(({ acceptStudyGroupRequest }) => {
                  acceptStudyGroupRequest(groupId, requesterId);
                });
              }}
              className="h-8 rounded-full bg-sky-600 px-4 text-xs font-bold text-white hover:bg-sky-700"
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                import('../../../utils/firebase/firestore').then(({ declineStudyGroupRequest }) => {
                  declineStudyGroupRequest(groupId, requesterId);
                });
              }}
              className="h-8 rounded-full px-4 text-xs font-bold"
            >
              Decline
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PulseRequestItem({ pulseId, requesterId, pulseText }: { pulseId: string, requesterId: string, pulseText: string }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    getProfile(requesterId).then(data => setProfile(data as UserProfile | null));
  }, [requesterId]);

  const handleAccept = async () => {
    setIsProcessing(true);
    const success = await acceptPulseRequest(pulseId, requesterId);
    if (success) {
      toast.success('Joined pulse!');
      // Send DM
      try {
        const convId = await createConversation(requesterId);
        if (convId) {
          await sendMessage(convId, `Let's go for "${pulseText}"! I'm down.`);
        }
      } catch (e) {
        console.error('Failed to notify requester:', e);
      }
    }
    setIsProcessing(false);
  };

  const handleDecline = async () => {
    setIsProcessing(true);
    await declinePulseRequest(pulseId, requesterId);
    setIsProcessing(false);
  };

  if (!profile) return null;

  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm border border-slate-100">
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={(profile as any).photoURL} className="object-cover" />
          <AvatarFallback>{(profile.name || 'U').charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-semibold text-slate-800">{profile.name}</h4>
          <p className="mt-0.5 text-xs text-slate-500">Wants to join your pulse</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={handleAccept} disabled={isProcessing} className="h-8 rounded-full bg-sky-600 px-4 text-xs font-bold text-white hover:bg-sky-700">
              {isProcessing ? '...' : 'Accept'}
            </Button>
            <Button size="sm" variant="outline" onClick={handleDecline} disabled={isProcessing} className="h-8 rounded-full px-4 text-xs font-bold">
              Ignore
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MessagesPage;

function PomodoroTimer({ initialView = 'pomodoro' }: { initialView?: 'pomodoro' | 'stopwatch' }) {
  const [view, setView] = useState<'pomodoro' | 'stopwatch'>(initialView);
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<'work' | 'break'>('work');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isStopwatchActive, setIsStopwatchActive] = useState(false);

  useEffect(() => {
    setView(initialView);
    setIsActive(false);
    setIsStopwatchActive(false);
  }, [initialView]);

  useEffect(() => {
    let interval: any;
    if (view === 'pomodoro' && isActive) {
      interval = setInterval(() => {
        if (seconds > 0) {
          setSeconds(seconds - 1);
        } else if (minutes > 0) {
          setMinutes(minutes - 1);
          setSeconds(59);
        } else {
          setIsActive(false);
          const nextMode = mode === 'work' ? 'break' : 'work';
          setMode(nextMode);
          setMinutes(nextMode === 'work' ? 25 : 5);
          setSeconds(0);
          toast.success(nextMode === 'work' ? 'Break over! Time to focus.' : 'Great job! Take a break.');
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, minutes, seconds, mode, view]);

  useEffect(() => {
    let interval: any;
    if (view === 'stopwatch' && isStopwatchActive) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isStopwatchActive, view]);

  const toggleTimer = () => setIsActive(!isActive);
  const resetTimer = () => {
    setIsActive(false);
    setMode('work');
    setMinutes(25);
    setSeconds(0);
  };

  const toggleStopwatch = () => setIsStopwatchActive(!isStopwatchActive);
  const resetStopwatch = () => {
    setIsStopwatchActive(false);
    setElapsedSeconds(0);
  };

  const formatStopwatch = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className={`rounded-2xl sm:rounded-3xl p-3 sm:p-6 text-center border-2 sm:border-4 transition-all duration-500 shadow-2xl ${
      view === 'stopwatch'
        ? 'bg-gradient-to-br from-sky-100 to-cyan-200 border-sky-300 shadow-sky-300/30'
        : mode === 'work'
        ? 'bg-gradient-to-br from-amber-100 to-orange-200 border-orange-300 shadow-orange-300/30' 
        : 'bg-gradient-to-br from-emerald-100 to-teal-200 border-emerald-300 shadow-emerald-300/30'
    }`}>
      <div className="mb-6 flex justify-center gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setView('pomodoro');
            setIsStopwatchActive(false);
          }}
          className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] ${view === 'pomodoro' ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-white/70 text-slate-600 hover:bg-white'}`}
        >
          <Timer className="h-3 w-3" />
          Pomodoro
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setView('stopwatch');
            setIsActive(false);
          }}
          className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] ${view === 'stopwatch' ? 'bg-sky-600 text-white hover:bg-sky-700' : 'bg-white/70 text-slate-600 hover:bg-white'}`}
        >
          <Clock className="h-3 w-3" />
          Stopwatch
        </Button>
      </div>

      {view === 'pomodoro' ? (
        <>
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-[10px] font-black uppercase tracking-[0.25em] ${
            mode === 'work' ? 'bg-orange-600 text-white shadow-md' : 'bg-emerald-600 text-white shadow-md'
          }`}>
            {mode === 'work' ? <Timer className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {mode === 'work' ? 'Focus Mode' : 'Break Time'}
          </div>

          <div className={`text-5xl sm:text-6xl md:text-7xl font-black tabular-nums mb-8 drop-shadow-md ${
            mode === 'work' ? 'text-orange-700' : 'text-emerald-700'
          }`}>
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>

          <div className="flex justify-center gap-4">
            <Button
              onClick={toggleTimer}
              className={`h-16 w-16 rounded-full shadow-xl transition-all active:scale-95 transform hover:scale-105 border-4 border-white ${
                isActive
                  ? 'bg-rose-500 hover:bg-rose-600 text-white'
                  : mode === 'work'
                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white'
              }`}
            >
              {isActive ? <Square className="h-6 w-6 fill-white" /> : <Play className="h-6 w-6 fill-white ml-1" />}
            </Button>
            <Button
              variant="outline"
              onClick={resetTimer}
              className="h-16 w-16 rounded-full border-4 border-white bg-white/80 backdrop-blur-sm text-slate-400 hover:bg-white hover:text-slate-600 shadow-lg transition-all"
            >
              <Clock className="h-6 w-6" />
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-[10px] font-black uppercase tracking-[0.25em] bg-sky-600 text-white shadow-md">
            <Clock className="h-3 w-3" />
            Session Timer
          </div>

          <div className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tabular-nums mb-8 drop-shadow-md text-sky-700">
            {formatStopwatch(elapsedSeconds)}
          </div>

          <div className="flex justify-center gap-4">
            <Button
              onClick={toggleStopwatch}
              className={`h-16 w-16 rounded-full shadow-xl transition-all active:scale-95 transform hover:scale-105 border-4 border-white ${
                isStopwatchActive ? 'bg-rose-500 hover:bg-rose-600 text-white' : 'bg-sky-500 hover:bg-sky-600 text-white'
              }`}
            >
              {isStopwatchActive ? <Square className="h-6 w-6 fill-white" /> : <Play className="h-6 w-6 fill-white ml-1" />}
            </Button>
            <Button
              variant="outline"
              onClick={resetStopwatch}
              className="h-16 w-16 rounded-full border-4 border-white bg-white/80 backdrop-blur-sm text-slate-400 hover:bg-white hover:text-slate-600 shadow-lg transition-all"
            >
              <Clock className="h-6 w-6" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function MessagesSkeleton() {
  return (
    <div className="h-full w-full flex flex-col animate-pulse bg-white">
      <div className="h-16 bg-slate-50 border-b border-slate-100 flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-full" />
          <div className="h-5 bg-slate-100 rounded w-24" />
        </div>
        <div className="w-8 h-8 bg-slate-100 rounded-full" />
      </div>
      <div className="flex-1 flex flex-col p-4 space-y-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-100 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-100 rounded w-1/4" />
              <div className="h-3 bg-slate-100 rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
