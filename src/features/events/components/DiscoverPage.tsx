import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { auth, isFirebaseConfigured } from '../../../utils/firebase/client';
import { sendFriendRequest, UserProfile, getEnhancedFriendProfile, EnhancedFriendProfile, getProfile, getFriendTimetable, type ClassItem, getAllUsers, getFriends, CampusEvent, getUpcomingEventsRealtime, loadTimetable, seedTestEvent, createConversation, createCampusEvent, getCheckIns, type CheckIn, getPulses, type Pulse, acceptPulseRequest, declinePulseRequest, requestToJoinPulse } from '../../../utils/firebase/firestore';
import { EventCard } from './EventCard';
import { EventChat } from '../../messaging/components/EventChat';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
// Supabase removed
import { Filter, Users, X, Send, Search, Check, Sparkles, MapPin, ExternalLink, Calendar, PlusCircle, AlertTriangle, ArrowRight, Activity, TrendingUp, Music, Camera, Users as UsersIcon, Coffee, Zap, MessageCircle, SlidersHorizontal, Globe2, UserPlus, Compass } from 'lucide-react';
import { useUniversity } from '../../../hooks/useUniversity';
import { getUniversityConfig } from '../../../config/universities';
import { formatTimeLabel } from '../../../utils/scheduleCompare';
import { formatEmailToName } from '../../../utils/nameUtils';
import { registerBackHandler } from '../../../utils/backButton';

type SuggestedUser = {
  id: string;
  name: string;
  major: string;
  year: string;
  mutualFriends?: number;
  sharedCourses?: string[];
  bio?: string;
  interests?: string[];
  online?: boolean;
  university?: string;
  clubs?: string[];
  photoURL?: string;
};

// Coursemates are derived in real-time from friends who share courses

export function DiscoverPage({ currentUser, onOpenProfile, onMessage }: { currentUser?: unknown; onOpenProfile?: (user: SuggestedUser) => void; onMessage?: () => void }) {
  console.log('🎯 DiscoverPage component is rendering!');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('name');
  const [activeTab, setActiveTab] = useState<string>('friends');
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [acceptedFriendIds, setAcceptedFriendIds] = useState<Set<string>>(new Set());
  const [friendsUsers, setFriendsUsers] = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<SuggestedUser | null>(null);
  const [enhancedProfile, setEnhancedProfile] = useState<EnhancedFriendProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(false);
  const [latestTimetable, setLatestTimetable] = useState<Array<{ day: string; time: string; title: string; where?: string }>>([]);

  // Events State
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [myTimetable, setMyTimetable] = useState<Record<string, ClassItem[]>>({});
  const [showBuddyModal, setShowBuddyModal] = useState<boolean>(false);
  const [selectedEventForBuddy, setSelectedEventForBuddy] = useState<CampusEvent | null>(null);
  const [buddyMatches, setBuddyMatches] = useState<{ user: SuggestedUser, status: string, isGoingAlone: boolean }[]>([]);

  const [showChatModal, setShowChatModal] = useState<boolean>(false);
  const [selectedEventForChat, setSelectedEventForChat] = useState<CampusEvent | null>(null);

  // Vibe Filter & Event Creation State
  const VIBE_CATEGORIES = ['All', 'Chill', 'Loud', 'Dance', 'Academic', 'Cultural', 'Sports', 'Mixed crowd'];
  const [selectedVibe, setSelectedVibe] = useState<string>('All');
  const [showCreateEventModal, setShowCreateEventModal] = useState<boolean>(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    location: '',
    vibeTags: [] as string[],
    crowdSize: 'Medium',
    buddyMatchingEnabled: true,
  });
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const university = useUniversity();

  const [loadingFriends, setLoadingFriends] = useState(true);

  useEffect(() => {
    const unsubscribeCheckIns = getCheckIns(setCheckIns, university.id);
    const unsubscribePulses = getPulses(setPulses, university.id);

    return () => {
      unsubscribeCheckIns();
      unsubscribePulses();
    };
  }, [currentUser, university.id]);

  useEffect(() => {
    // Load Events and My Timetable
    setLoadingEvents(true);
    const unsubscribeEvents = getUpcomingEventsRealtime((evs) => {
      // Sort: Sponsored first, then by startTime
      const sortedEvs = [...evs].sort((a, b) => {
        if (a.isSponsored && !b.isSponsored) return -1;
        if (!a.isSponsored && b.isSponsored) return 1;
        return a.startTime.toMillis() - b.startTime.toMillis();
      });
      setEvents(sortedEvs);
      setLoadingEvents(false);
    }, university.id);

    const loadTimetableData = async () => {
      const myT = await loadTimetable();
      setMyTimetable(myT);
    };
    loadTimetableData();

    return () => {
      unsubscribeEvents();
    };
  }, [currentUser, university.id]); // Re-run when currentUser is available

  useEffect(() => {
    return registerBackHandler(() => {
      if (showBuddyModal) {
        setShowBuddyModal(false);
        return true;
      }
      if (showChatModal) {
        setShowChatModal(false);
        return true;
      }
      if (showCreateEventModal) {
        setShowCreateEventModal(false);
        return true;
      }
      return false;
    });
  }, [showBuddyModal, showChatModal, showCreateEventModal]);

  // Fetch buddies for selected event
  useEffect(() => {
    const fetchBuddies = async () => {
      if (!selectedEventForBuddy) return;
      setBuddyMatches([]);
      const attendees = await import('../../../utils/firebase/firestore').then(m => m.getEventAttendees(selectedEventForBuddy.id));

      const matches: { user: SuggestedUser, status: string, isGoingAlone: boolean }[] = [];

      attendees.forEach(att => {
        // Find in friends list
        const friend = friendsUsers.find(f => f.id === att.userId);
        if (friend && acceptedFriendIds.has(friend.id)) {
          matches.push({
            user: friend,
            status: att.status,
            isGoingAlone: att.isGoingAlone
          });
        }
      });

      // Sort: Going Alone first, then by name
      matches.sort((a, b) => {
        if (a.isGoingAlone && !b.isGoingAlone) return -1;
        if (!a.isGoingAlone && b.isGoingAlone) return 1;
        return a.user.name.localeCompare(b.user.name);
      });

      setBuddyMatches(matches);
    };
    fetchBuddies();
  }, [selectedEventForBuddy, friendsUsers, acceptedFriendIds]); // Added dependencies

  useEffect(() => {
    setLoadingUsers(true);
    // Subscribe to all registered users of UniNest (excluding the current user)
    const unsubscribe = getAllUsers(async (list) => {
      // Filter out current user and respect privacy settings
      const others = list.filter(u => {
        if (u.uid === auth.currentUser?.uid) return false;
        
        // Strictly ensure the user belongs to the current university
        const docUniId = u.universityId;
        if (docUniId && docUniId !== university.id) return false;
        if (!docUniId && u.university && getUniversityConfig(u.university).id !== university.id) return false;
        
        const isGhost = u.privacySettings?.ghostMode === true;
        const discoverVisible = u.privacySettings?.discoverVisible !== false;
        
        if (isGhost || !discoverVisible) return false;
        
        return true;
      });
      
      const transformed = await Promise.all(others.map(async (u) => {
        let profileName: string | null = null;
        let profileMajor: string | null = null;
        let profileYear: string | null = null;
        let profilePhotoURL: string | null = null;
        try {
          const p = await getProfile(u.uid);
          profileName = (p as any)?.name || p?.displayName;
          profileMajor = (p as any)?.major || null;
          profileYear = (p as any)?.year || null;
          profilePhotoURL = (p as any)?.photoURL || null;
        } catch (e) {}

        const suggested = transformUserProfileToSuggestedUser(u);
        if (profileName) {
           // If it came from profiles collection (profileDoc.name), use it as is.
           // If it came from users collection (displayName), it's already formatted by transform function if needed.
           suggested.name = profileName;
        }
        if (profileMajor) {
          suggested.major = profileMajor;
        }
        if (profileYear) {
          suggested.year = profileYear.match(/^\d{4}$/) ? `Class of '${profileYear.slice(2)}` : profileYear;
        }
        if (profilePhotoURL) {
          suggested.photoURL = profilePhotoURL;
        }
        return suggested;
      }));
      setFriendsUsers(transformed);
      setLoadingUsers(false);
    }, university.id);
    return () => { unsubscribe && unsubscribe(); };
  }, [university.id]);

  // Subscribe to accepted friends to gate the Add Friend button
  useEffect(() => {
    const unsubscribeFriends = getFriends((friendsList: UserProfile[]) => {
      const ids = new Set<string>(friendsList.map((f) => f.uid));
      setAcceptedFriendIds(ids);
    });
    return () => { unsubscribeFriends && unsubscribeFriends(); };
  }, [currentUser]);

  // Function to handle profile click and fetch enhanced data
  const handleProfileClick = async (user: SuggestedUser) => {
    setSelectedUser(user);
    setLoadingProfile(true);
    setEnhancedProfile(null);
    setLatestTimetable([]);

    try {
      if (isFirebaseConfigured && auth.currentUser) {
        console.log('🔍 Fetching enhanced profile for user:', user.id);
        const enhanced = await getEnhancedFriendProfile(user.id);
        setEnhancedProfile(enhanced);
        console.log('✅ Enhanced profile loaded:', enhanced);
      }
    } catch (error) {
      console.error('❌ Error loading enhanced profile:', error);
    } finally {
      setLoadingProfile(false);
    }
  };

  // Fetch the latest timetable for the selected user to avoid stale data
  useEffect(() => {
    const loadLatestTimetable = async () => {
      try {
        if (!selectedUser?.id) return;
        const raw = await getFriendTimetable(selectedUser.id);
        const arr: Array<{ day: string; time: string; title: string; where?: string }> = [];
        Object.entries(raw).forEach(([day, classes]) => {
          (classes as ClassItem[]).forEach((c) => {
            arr.push({
              day,
              time: c.time,
              title: c.title || c.course,
              where: c.location || c.academicBlock
            });
          });
        });
        setLatestTimetable(arr);
      } catch (e) {
        console.warn('Failed to load latest timetable for selected user', e);
      }
    };
    loadLatestTimetable();
  }, [selectedUser?.id]);

  // Helper function to transform UserProfile to SuggestedUser
  function transformUserProfileToSuggestedUser(userProfile: UserProfile): SuggestedUser {
    const isGhost = !!userProfile.privacySettings?.ghostMode;
    const showStatus = userProfile.privacySettings?.onlineStatusVisible !== false && !isGhost;
    
    // Consider them online if active in last 5 mins OR if they have an active physical status
    const isRecentlyActive = !!userProfile.lastActive && (Date.now() - userProfile.lastActive.toDate().getTime() < 5 * 60 * 1000);
    const hasActiveStatus = userProfile.status === 'available' || userProfile.status === 'in library' || userProfile.status === 'in ground';
    const isOnline = showStatus && (isRecentlyActive || hasActiveStatus);

    return {
      id: userProfile.uid || 'unknown',
      name: userProfile.name || formatEmailToName(userProfile.displayName || userProfile.email),
      major: userProfile.major || 'Unknown Major',
      year: userProfile.year && userProfile.year.match(/^\d{4}$/) ? `Class of '${userProfile.year.slice(2)}` : (userProfile.year || 'Unknown Year'),
      bio: userProfile.bio || undefined,
      interests: userProfile.interests || [],
      online: isOnline,
      university: userProfile.university || 'Unknown University',
      mutualFriends: 0, // TODO: Calculate mutual friends
      sharedCourses: [], // TODO: Calculate shared courses
      clubs: userProfile.clubs || [],
      photoURL: userProfile.photoURL
    };
  };

  const [addingFriend, setAddingFriend] = useState<string | null>(null);

  const handleSendRequest = async (userId: string): Promise<void> => {
    setAddingFriend(userId);
    try {
      if (isFirebaseConfigured && auth.currentUser) {
        // Send friend request using Firebase
        await sendFriendRequest(userId);
      } else {
        // Supabase removed: directly mark request as sent in mock mode
      }
      setSentRequests(new Set([...sentRequests, userId]));
    } catch (error) {
      console.error('Error sending friend request:', error);
    } finally {
      setAddingFriend(null);
    }
  };

  const getMutualClubs = (u: SuggestedUser): string[] => {
    const friendClubs = Array.isArray(u.clubs) ? u.clubs : [];
    const myClubs = Array.isArray((currentUser as any)?.clubs) ? (currentUser as any).clubs : [];
    if (!friendClubs.length || !myClubs.length) return [];
    const mineSet = new Set(myClubs.map((c: string) => (c || '').toLowerCase().trim()));
    return friendClubs.filter((c: string) => mineSet.has((c || '').toLowerCase().trim()));
  };

  const filteredFriends: SuggestedUser[] = friendsUsers.filter((user: SuggestedUser) => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.major.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.interests?.some((interest) => interest.toLowerCase().includes(searchQuery.toLowerCase())) ?? false);

    if (!matchesSearch) return false;

    if (sortBy === 'online') return user.online;
    if (sortBy === 'sharedCourses') return user.sharedCourses && user.sharedCourses.length > 0;
    if (sortBy === 'mutualClubs') return getMutualClubs(user).length > 0;

    return true;
  });

  const renderProfileContent = (): React.ReactNode => {
    const u = selectedUser as SuggestedUser;
    const profile = enhancedProfile;

    const displayInterests = profile?.interests?.length ? profile.interests : (u?.interests ?? []);
    const displayClubs = profile?.clubs?.length ? profile.clubs : [];
    const displayTimetable = (latestTimetable.length > 0) ? latestTimetable : (profile?.timetable?.length ? profile.timetable : []);
    const displaySharedCourses = profile?.sharedCourses?.length ? profile.sharedCourses : (u?.sharedCourses ?? []);

    const dayOrder: Record<string, number> = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5, SUN: 6 };
    const normalizeDay = (d: string | undefined): number => {
      if (!d) return 99;
      const key = d.slice(0, 3).toUpperCase();
      return dayOrder[key] ?? 99;
    };
    const toMinutes = (t: string | undefined): number => {
      if (!t) return 24 * 60;
      const m = t.trim().match(/^([0-9]{1,2}):([0-9]{2})\s*(AM|PM)$/i);
      if (!m) return 24 * 60;
      let hh = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);
      const ap = m[3].toUpperCase();
      if (ap === 'AM') { if (hh === 12) hh = 0; } else { if (hh !== 12) hh += 12; }
      return hh * 60 + mm;
    };
    const sortedTimetable = [...displayTimetable].sort((a: any, b: any) => {
      const dayDiff = normalizeDay(a.day) - normalizeDay(b.day);
      if (dayDiff !== 0) return dayDiff;
      return toMinutes(a.time) - toMinutes(b.time);
    });

    return (
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="relative pb-6">
          <div className="h-32 bg-gradient-to-br from-sky-400/20 to-violet-400/20 rounded-b-[2rem]" />
          <div className="absolute top-16 left-0 right-0 flex flex-col items-center">
            <Avatar className="h-24 w-24 border-4 border-white shadow-xl">
              <AvatarImage src={u?.photoURL} className="object-cover" />
              <AvatarFallback className="bg-sky-100 text-2xl font-bold text-sky-700">{u?.name?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="mt-3 text-center px-6">
              <h3 className="text-xl font-extrabold text-slate-800">{u?.name}</h3>
              <p className="text-sm font-medium text-slate-500 mt-0.5">{profile?.major || u?.major} • {(profile?.year || u?.year)?.includes('Class') ? (profile?.year || u?.year) : ((profile?.year || u?.year)?.match(/^\d{4}$/) ? `Class of '${(profile?.year || u?.year)?.slice(2)}` : `Year ${profile?.year || u?.year}`)}</p>
            </div>
          </div>
        </div>
        <div className="px-6 pt-16 pb-8 space-y-6">
          <div className="flex justify-center">
            {profile?.mutualFriends !== undefined && (
              <span className="rounded-full bg-sky-400/10 px-4 py-1.5 text-xs font-bold text-sky-600 ring-1 ring-sky-400/20">
                {profile.mutualFriends} mutual friends
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
             <div className="rounded-2xl bg-white/60 p-3 ring-1 ring-sky-400/10 flex flex-col items-center text-center">
              <Globe2 className="h-4 w-4 text-sky-400 mb-1" />
              <span className="text-[9px] font-bold text-slate-400 uppercase">Campus</span>
              <span className="text-xs font-bold text-slate-700 truncate w-full">{profile?.university || (u as any).university || 'UniNest'}</span>
            </div>
            <div className="rounded-2xl bg-white/60 p-3 ring-1 ring-sky-400/10 flex flex-col items-center text-center">
              <MapPin className="h-4 w-4 text-sky-400 mb-1" />
              <span className="text-[9px] font-bold text-slate-400 uppercase">Major</span>
              <span className="text-xs font-bold text-slate-700 truncate w-full">{profile?.major || u?.major}</span>
            </div>
          </div>
          <Tabs defaultValue="interests" className="w-full">
            <TabsList className="grid grid-cols-3 w-full h-11 bg-white/60 rounded-xl p-1">
              <TabsTrigger value="interests" className="rounded-lg text-xs font-bold">Interests</TabsTrigger>
              <TabsTrigger value="clubs" className="rounded-lg text-xs font-bold">Clubs</TabsTrigger>
              <TabsTrigger value="schedule" className="rounded-lg text-xs font-bold">Schedule</TabsTrigger>
            </TabsList>
            <TabsContent value="interests" className="mt-4">
              <div className="flex flex-wrap gap-2">
                {displayInterests.map((interest, i) => (
                  <span key={i} className="rounded-full bg-sky-400/10 px-3 py-1.5 text-xs font-medium text-sky-600 ring-1 ring-sky-400/20">{interest}</span>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="clubs" className="mt-4 space-y-2">
              {displayClubs.map((club, i) => (
                <div key={i} className="rounded-xl bg-white/60 p-3 ring-1 ring-sky-400/10 flex items-center gap-3">
                  <Compass className="w-3.5 h-3.5 text-violet-600" />
                  <span className="text-xs font-bold text-slate-800">{club}</span>
                </div>
              ))}
            </TabsContent>
            <TabsContent value="schedule" className="mt-4 space-y-3">
              {sortedTimetable.length > 0 ? (
                sortedTimetable.map((item: any, i) => (
                  <div key={i} className="rounded-xl bg-white/60 p-3 ring-1 ring-sky-400/10 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-800">{item.title}</div>
                      <div className="text-[10px] text-slate-400">{item.day} • {item.time}</div>
                    </div>
                  </div>
                ))
              ) : <p className="text-center text-slate-400 text-xs italic">No schedule shared.</p>}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  };

  const sortUsers = (arr: SuggestedUser[]): SuggestedUser[] => {
    const copy = [...arr];
    switch (sortBy) {
      case 'name':
        return copy.sort((a, b) => a.name.localeCompare(b.name));
      case 'major':
        return copy.sort((a, b) => (a.major || '').localeCompare(b.major || ''));
      case 'online':
        return copy.sort((a, b) => Number(Boolean(b.online)) - Number(Boolean(a.online)));
      case 'sharedCourses':
        return copy.sort((a, b) => (b.sharedCourses?.length || 0) - (a.sharedCourses?.length || 0));
      case 'mutualClubs':
        return copy.sort((a, b) => getMutualClubs(b).length - getMutualClubs(a).length);
      default:
        return copy;
    }
  };

  // Navigate to full FriendProfile page with enhanced data when a card is clicked
  const openPersonProfile = (person: SuggestedUser) => {
    if (onOpenProfile && person?.id) {
      onOpenProfile(person as any);
      return;
    }
    // Fallback: show inline dialog with enhanced details
    handleProfileClick(person);
  };

  const isAuthorized = !!auth.currentUser;

  return (
    <div className="relative bg-sky-50 font-sans text-slate-800 pb-[calc(5rem+env(safe-area-inset-bottom))] min-h-[100dvh]" style={{fontFamily: "'Inter', sans-serif"}}>
      {/* Ambient background blurs */}
      <div aria-hidden className="pointer-events-none absolute -top-64 left-[234px] w-48 h-48 bg-sky-400/10 rounded-full blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute bottom-0 -left-10 w-48 h-48 bg-violet-500/5 rounded-full blur-3xl" />

      {/* Top Navigation Anchor */}
      <header className="sticky top-0 w-full z-50 bg-white/60 border-b border-sky-400/10 backdrop-blur-md flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-sky-400/20">
            <Avatar className="w-full h-full">
               <AvatarImage src={(auth.currentUser as any)?.photoURL} className="object-cover" />
               <AvatarFallback className="bg-sky-100 text-sky-700 font-bold">{auth.currentUser?.displayName?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-sky-400" style={{fontFamily: "'Plus Jakarta Sans', sans-serif"}}>Discover</h1>
        </div>
      </header>

      <main className="relative pb-8">
        {/* Search & Filters */}
        <section className="px-6 py-4 space-y-4">
          <div className="relative flex items-center bg-white/80 rounded-2xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)] ring-1 ring-sky-400/5 backdrop-blur-sm focus-within:ring-sky-400/30 transition-all duration-300">
            <Search className="w-4 h-4 text-slate-400 mr-3" />
            <input
              data-testid="discover-search-input"
              className="bg-transparent border-none focus:outline-none focus:ring-0 w-full text-slate-700 placeholder:text-slate-400 text-base"
              placeholder="Search people, interests, courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              type="text"
            />
          </div>
          <div className="flex overflow-x-auto no-scrollbar gap-2 py-1">
            {[
              { key: 'all', label: 'All' },
              { key: 'name', label: 'Name' },
              { key: 'major', label: 'Major' },
              { key: 'online', label: 'Online' },
              { key: 'sharedCourses', label: 'Courses' },
              { key: 'mutualClubs', label: 'Clubs' },
            ].map(({ key, label }) => {
                const isAll = key === 'all';
                const active = isAll ? (sortBy === 'name' || !sortBy) : sortBy === key;
                return (
                    <button
                        key={key}
                        data-testid={`discover-filter-${key}`}
                        onClick={() => setSortBy(isAll ? 'name' : key)}
                        className={`px-5 py-2.5 rounded-full text-sm font-semibold tracking-tight whitespace-nowrap transition-all active:scale-95 ${active ? 'bg-sky-400 text-white shadow-[0_10px_15px_-3px_rgba(56,189,248,0.25),0_4px_6px_-4px_rgba(56,189,248,0.25)]' : 'bg-white text-slate-600 ring-1 ring-sky-400/10 hover:ring-sky-400/30'}`}
                    >
                        {label}
                    </button>
                )
            })}
          </div>
        </section>

        {/* Pulse Requests Section */}
        {pulses.filter(p => p.createdBy === auth.currentUser?.uid && p.joinRequests && p.joinRequests.length > 0).map(pulse => (
          <section key={pulse.id} className="mt-4 px-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Pulse Requests</h2>
            </div>
            {pulse.joinRequests?.map(requesterId => (
               <PulseRequestItem key={requesterId} pulse={pulse} requesterId={requesterId} />
            ))}
          </section>
        ))}

        {/* Active Public Pulses */}
        {pulses.filter(p => p.createdBy !== auth.currentUser?.uid && p.isPublic).length > 0 && (
          <section className="mt-4 px-6">
            <h2 className="text-lg font-extrabold tracking-tight mb-4 text-slate-800" style={{fontFamily: "'Plus Jakarta Sans', sans-serif"}}>Active Pulses</h2>
            <div className="flex overflow-x-auto no-scrollbar gap-4 pb-2">
              {pulses.filter(p => p.createdBy !== auth.currentUser?.uid && p.isPublic).map(pulse => (
                 <PublicPulseCard key={pulse.id} pulse={pulse} />
              ))}
            </div>
          </section>
        )}
        
        {/* Nearby Now */}
        <section className="py-4 bg-sky-400/5 mt-4">
          <div className="px-6 mb-4">
            <h2 className="text-lg font-extrabold tracking-tight text-slate-800" style={{fontFamily: "'Plus Jakarta Sans', sans-serif"}}>Nearby Now</h2>
          </div>
          <div className="flex overflow-x-auto no-scrollbar gap-6 px-6">
            {checkIns.length > 0 ? (
              checkIns.map((ci, idx) => {
                const friend = friendsUsers.find(f => f.id === ci.createdBy);
                if (!friend) return null;
                const ringCls = idx < 2 ? 'ring-sky-400' : 'ring-sky-400/20';
                return (
                  <div key={ci.id} data-testid={`nearby-${ci.id}`} onClick={() => openPersonProfile(friend)} className="flex flex-col items-center gap-2 min-w-fit cursor-pointer group">
                    <div className={`relative p-1 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] ring-2 ${ringCls} group-hover:scale-105 transition-transform`}>
                      <Avatar className="w-16 h-16">
                        <AvatarImage src={friend.photoURL} className="object-cover" />
                        <AvatarFallback className="bg-sky-100 text-sky-700 font-bold text-lg">{friend.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      {friend.online && (
                        <div className="absolute bottom-0.5 right-0.5 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold w-16 truncate text-slate-800">{friend.name}</p>
                      <p className="text-[9px] text-slate-400 uppercase tracking-tight w-16 truncate font-normal">{ci.location}</p>
                    </div>
                  </div>
                )
              })
            ) : (
               <div className="px-6 py-4 text-sm text-slate-500 italic">No one checked in nearby just yet!</div>
            )}
          </div>
        </section>

        {/* People You May Know */}
        <section className="mt-8 px-6">
          <h2 className="text-lg font-extrabold tracking-tight text-slate-800 mb-6" style={{fontFamily: "'Plus Jakarta Sans', sans-serif"}}>People You May Know</h2>
          <div className="space-y-6 max-h-[42rem] overflow-y-auto pr-1">
            {loadingUsers ? (
              [1, 2, 3].map(i => <PersonSkeleton key={i} />)
            ) : sortUsers(filteredFriends).map((friend) => (
              <div
                key={friend.id}
                data-testid={`person-card-${friend.id}`}
                className="flex items-center gap-4 p-3 bg-white/40 rounded-3xl ring-1 ring-sky-400/5 cursor-pointer hover:bg-white/70 hover:ring-sky-400/20 transition-all duration-300"
                onClick={() => openPersonProfile(friend)}
              >
                <Avatar className="w-14 h-14 rounded-2xl shadow-[0_0_0_2px_rgba(56,189,248,0.05)]">
                  <AvatarImage src={friend.photoURL} className="object-cover" />
                  <AvatarFallback className="bg-sky-100 text-sky-700 text-lg font-bold rounded-2xl">{friend.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm truncate text-slate-800 leading-5">{friend.name}</h3>
                  <p className="text-xs text-slate-400 truncate font-normal leading-4">{friend.major} • {friend.year}</p>
                  <div className="flex gap-2 mt-1 pt-0.5">
                    {(friend.sharedCourses && friend.sharedCourses.length > 0) ? (
                      <span className="text-[9px] font-bold text-sky-400 tracking-wide uppercase">{friend.sharedCourses.length} shared</span>
                    ) : (friend.mutualFriends !== undefined && friend.mutualFriends > 0) ? (
                      <span className="text-[9px] font-bold text-sky-400 tracking-wide uppercase">{friend.mutualFriends} mutual</span>
                    ) : null}
                    {getMutualClubs(friend).length > 0 && (
                      <span className="text-[9px] font-bold text-violet-500 tracking-wide uppercase truncate max-w-[120px]">{getMutualClubs(friend)[0]}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {acceptedFriendIds.has(friend.id) ? (
                    <button
                      data-testid={`person-message-${friend.id}`}
                      onClick={(e) => { e.stopPropagation(); createConversation(friend.id); if (onMessage) onMessage(); }}
                      className="w-10 h-10 flex items-center justify-center bg-sky-400/10 text-sky-400 rounded-full hover:bg-sky-400 hover:text-white transition-all duration-300"
                    >
                      <MessageCircle className="w-5 h-5" />
                    </button>
                  ) : sentRequests.has(friend.id) ? (
                    <button disabled className="w-10 h-10 flex items-center justify-center bg-slate-100 text-slate-400 rounded-full">
                      ✓
                    </button>
                  ) : (
                    <button
                      data-testid={`person-add-${friend.id}`}
                      onClick={(e) => { e.stopPropagation(); handleSendRequest(friend.id); }}
                      className="w-10 h-10 flex items-center justify-center bg-sky-400/10 text-sky-400 rounded-full hover:bg-sky-400 hover:text-white transition-all duration-300"
                    >
                      <UserPlus className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* What's Happening */}
        <section className="mt-12">
          <div className="px-6 mb-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold tracking-tight text-slate-800" style={{fontFamily: "'Plus Jakarta Sans', sans-serif"}}>What's Happening</h2>
              <SlidersHorizontal className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex overflow-x-auto no-scrollbar gap-2 -mx-6 px-6">
              {VIBE_CATEGORIES.map(vibe => {
                const active = selectedVibe === vibe;
                return (
                  <button
                    key={vibe}
                    data-testid={`vibe-filter-${vibe.toLowerCase()}`}
                    onClick={() => setSelectedVibe(vibe)}
                    className={`px-4 py-1.5 font-bold text-[10px] uppercase tracking-wide rounded-full transition-all whitespace-nowrap ${active ? 'bg-sky-400/10 text-sky-400 ring-1 ring-sky-400/20' : 'bg-white text-slate-600 ring-1 ring-sky-400/5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:ring-sky-400/20'}`}
                  >
                    {vibe === 'All' ? 'All Vibes' : vibe}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Vertical Event Feed */}
          <div className="space-y-4">
            {loadingEvents ? (
              [1, 2].map(i => <EventSkeleton key={i} />)
            ) : (
              (() => {
                 const filteredEvs = selectedVibe === 'All' 
                   ? events 
                   : events.filter(e => e.vibeTags?.includes(selectedVibe));
                 return filteredEvs.length > 0 ? (
                    filteredEvs.map(event => (
                        <EventCard
                          key={event.id}
                          event={event}
                          userTimetable={myTimetable}
                          onFindBuddy={(evt) => {
                            setSelectedEventForBuddy(evt);
                            setShowBuddyModal(true);
                          }}
                          onOpenChat={(evt) => {
                            setSelectedEventForChat(evt);
                            setShowChatModal(true);
                          }}
                        />
                    ))
                 ) : (
                    <div className="text-center py-12 bg-slate-50 mt-2 mx-6 rounded-3xl border border-slate-100/50">
                      <span className="text-3xl opacity-50 mb-3 block">👻</span>
                      <p className="text-slate-500 font-semibold text-[14px]">No {selectedVibe.toLowerCase()} events coming up.</p>
                    </div>
                 );
              })()
            )}
          </div>
        </section>
      </main>



      {/* Modals directly migrated from old code */}
      {selectedUser && (
        <Dialog open={!!selectedUser} onOpenChange={(open: boolean) => { if (!open) { setSelectedUser(null); setEnhancedProfile(null); } }}>
          <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col glass-panel border-white/60 p-0 text-slate-800 shadow-2xl sm:rounded-3xl">
            <DialogHeader className="flex-shrink-0 p-6 border-b border-gray-100/50">
              <DialogTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-sky-500 to-blue-600">{(selectedUser as SuggestedUser)?.name}</DialogTitle>
            </DialogHeader>
            {loadingProfile ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="w-10 h-10 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-slate-400 font-medium">Loading profile details...</p>
                </div>
              </div>
            ) : (
              renderProfileContent()
            )}
            <div className="p-4 border-t border-white/10 flex bg-white/40 backdrop-blur-md">
              <Button
                onClick={() => setSelectedUser(null)}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white font-bold shadow-md shadow-sky-200/50"
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={showBuddyModal} onOpenChange={setShowBuddyModal}>
        <DialogContent className="max-w-md glass-panel border-white/60 p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800">
              Find a Buddy for {selectedEventForBuddy?.title}
            </DialogTitle>
            <p className="text-sm text-slate-500">
              These friends are also interested or going!
            </p>
          </DialogHeader>

          <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto">
            {buddyMatches.length > 0 ? (
              buddyMatches.map(({ user, status, isGoingAlone }) => (
                <div key={user.id} className="flex items-center gap-4 p-3 rounded-xl bg-white/50 border border-white/60 shadow-sm hover:shadow-md transition-all">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={user.photoURL} className="object-cover" />
                    <AvatarFallback className="bg-sky-100 text-sky-600 font-bold">{user.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800">{user.name}</h4>
                    <div className="flex gap-2 text-xs mt-1">
                      <span className={status === 'attending' ? 'px-2 py-0.5 rounded-full bg-green-100 text-green-700' : 'px-2 py-0.5 rounded-full bg-slate-100 text-slate-600'}>
                        {status === 'attending' ? 'Going' : 'Interested'}
                      </span>
                      {isGoingAlone && (
                        <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                          Going Alone 🥺
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="rounded-full text-sky-600 border-sky-200 hover:bg-sky-50" onClick={() => {
                      setShowBuddyModal(false);
                      openPersonProfile(user);
                    }}>
                      Profile
                    </Button>
                    <Button size="sm" className="rounded-full bg-sky-500 hover:bg-sky-600" onClick={async () => {
                      try {
                        const m = await import('../../../utils/firebase/firestore');
                        const conversationId = await m.createConversation(user.id);
                        if (conversationId) {
                          const messageText = `I wanted to join with you for ${selectedEventForBuddy?.title}`;
                          await m.sendMessage(conversationId, messageText);
                          const { toast } = await import('sonner');
                          toast.success('Message sent!', { description: 'Check your Messages tab.' });
                          setShowBuddyModal(false);
                          if (onMessage) onMessage();
                        }
                      } catch (e) {
                        console.error(e);
                      }
                    }}>
                      Chat
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">🦗</div>
                <p className="text-slate-500">No friends found for this event yet.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showChatModal} onOpenChange={setShowChatModal}>
        <DialogContent className="max-w-md glass-panel border-white/60 p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b border-slate-100/50 bg-white/40 backdrop-blur-md">
            <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              💬 {selectedEventForChat?.title} <span className="text-xs font-normal text-slate-500">Chat</span>
            </DialogTitle>
          </DialogHeader>
          {selectedEventForChat && (
            <EventChat
              eventId={selectedEventForChat.id}
              eventTitle={selectedEventForChat.title}
              onClose={() => setShowChatModal(false)}
            />
          )}
        </DialogContent>
      </Dialog>


    </div>
  );
}



function PulseRequestItem({ pulse, requesterId }: { pulse: Pulse, requesterId: string }) {
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
    <div className="rounded-2xl bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.06)] mb-2 ring-1 ring-sky-500/10">
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={requester.photoURL} className="object-cover" />
          <AvatarFallback>{(requester.name || 'U').charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h4 className="text-sm font-bold text-slate-900">{requester.name}</h4>
          <p className="text-xs text-slate-500">Wants to join: "{pulse.text}"</p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                import('../../../utils/firebase/firestore').then(({ acceptPulseRequest }) => {
                  acceptPulseRequest(pulse.id!, requesterId);
                });
              }}
              className="flex-1 rounded-xl bg-sky-500 py-2 text-xs font-bold text-white transition hover:bg-sky-600 shadow-sm shadow-sky-500/20"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => {
                import('../../../utils/firebase/firestore').then(({ declinePulseRequest }) => {
                  declinePulseRequest(pulse.id!, requesterId);
                });
              }}
              className="flex-1 rounded-xl bg-slate-50 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 ring-1 ring-slate-200"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PublicPulseCard({ pulse }: { pulse: Pulse }) {
  const [creator, setCreator] = useState<any>(null);
  
  useEffect(() => {
    import('../../../utils/firebase/firestore').then(({ getProfile }) => {
      getProfile(pulse.createdBy).then(p => {
        if (p) setCreator(p);
      });
    });
  }, [pulse.createdBy]);

  if (!creator) return null;

  const uid = auth.currentUser?.uid;
  const isPending = uid && pulse.joinRequests?.includes(uid);
  const isJoined = uid && pulse.participants?.includes(uid);

  return (
    <div className="min-w-[240px] shrink-0 rounded-3xl bg-gradient-to-br from-sky-400 to-sky-600 p-4 shadow-[0_8px_16px_-4px_rgba(56,189,248,0.4)] text-white relative overflow-hidden">
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <Avatar className="h-8 w-8 ring-2 ring-white/20 shadow-sm">
            <AvatarImage src={creator.photoURL} className="object-cover" />
            <AvatarFallback className="bg-sky-700 text-white text-xs">{creator.name?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <h4 className="text-xs font-bold">{creator.name}</h4>
            {pulse.location && <p className="text-[9px] font-semibold text-white/80 uppercase tracking-widest">{pulse.location}</p>}
          </div>
        </div>
        <p className="text-sm font-medium mb-4 leading-tight">"{pulse.text}"</p>
        
        {isJoined ? (
          <div className="w-full py-2.5 rounded-xl bg-white/20 text-white text-xs font-bold text-center backdrop-blur-sm">
            Joined
          </div>
        ) : isPending ? (
          <div className="w-full py-2.5 rounded-xl bg-white/10 text-white/90 text-xs font-bold text-center border border-white/20">
            Requested...
          </div>
        ) : (
          <button 
            onClick={() => {
              import('../../../utils/firebase/firestore').then(({ requestToJoinPulse }) => {
                requestToJoinPulse(pulse.id!);
              });
            }}
            className="w-full py-2.5 rounded-xl bg-white text-sky-600 text-xs font-bold shadow-sm active:scale-95 transition-transform"
          >
            Request to Join
          </button>
        )}
      </div>
    </div>
  );
}

function PersonSkeleton() {
  return (
    <div className="flex items-center gap-4 p-3 bg-white/40 rounded-3xl ring-1 ring-sky-400/5 animate-pulse">
      <div className="w-14 h-14 rounded-2xl bg-slate-100" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-100 rounded w-1/3" />
        <div className="h-3 bg-slate-100 rounded w-1/2" />
      </div>
      <div className="w-10 h-10 rounded-full bg-slate-100" />
    </div>
  );
}

function EventSkeleton() {
  return (
    <div className="mx-6 p-4 bg-white/60 rounded-[32px] ring-1 ring-sky-400/10 animate-pulse space-y-4">
      <div className="h-48 bg-slate-100 rounded-3xl w-full" />
      <div className="space-y-2">
        <div className="h-5 bg-slate-100 rounded w-3/4" />
        <div className="h-4 bg-slate-100 rounded w-1/2" />
      </div>
    </div>
  );
}
