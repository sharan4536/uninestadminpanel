import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Clock3,
  Globe2,
  Info,
  MapPin,
  Sparkles,
  MessageSquare,
  UserPlus,
  Compass,
  Star,
  Flag,
  Ban,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../../components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar';
import { Button } from '../../../components/ui/button';
import { MutualFreeTime } from '../../timetable/components/MutualFreeTime';
import { HangoutPlanner } from '../../timetable/components/HangoutPlanner';
import { formatEmailToName } from '../../../utils/nameUtils';
import { 
  getFriendTimetable, 
  type ClassItem, 
  getEnhancedFriendProfile, 
  type EnhancedFriendProfile, 
  getProfile, 
  loadTimetable, 
  createConversation,
  getFriends,
  submitReport,
  getBlockedUsers,
  blockUser,
  unblockUser,
} from '../../../utils/firebase/firestore';
import { WEEKDAYS, getTodayKey, type DayKey, isBothFreeNow } from '../../../utils/scheduleCompare';

type FriendUser = {
  id?: string;
  name: string;
  displayName?: string;
  major?: string;
  year?: string;
  university?: string;
  email?: string;
  bio?: string;
  interests?: string[];
  clubs?: string[];
  sharedCourses?: string[];
  timetable?: Array<{ day: string; time: string; title: string; where?: string }>;
  course?: string;
  studyGroup?: string | null;
  photoURL?: string;
};

type TabKey = 'clubs' | 'schedule' | 'mutual';

const tabLabels: Array<{ id: TabKey; label: string }> = [
  { id: 'schedule', label: 'Schedule' },
  { id: 'mutual', label: 'Mutual' },
  { id: 'clubs', label: 'Clubs' },
];

export function FriendProfilePage({ user, onBack, onMessage }: { user?: FriendUser | null; onBack: () => void; onMessage?: () => void }) {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const stateUser = location.state?.user as FriendUser | undefined;

  const resolvedUser = user || stateUser || null;
  const resolvedId = id || resolvedUser?.id;

  const [activeTab, setActiveTab] = useState<TabKey | 'about'>('about');
  const [latestTimetable, setLatestTimetable] = useState<Array<{ day: string; time: string; title: string; where?: string }>>(resolvedUser?.timetable || []);
  const [enhanced, setEnhanced] = useState<EnhancedFriendProfile | null>(null);
  const [profileDoc, setProfileDoc] = useState<any>(null);
  const [friendTimetable, setFriendTimetable] = useState<Record<string, ClassItem[]>>({});
  const [currentUserTimetable, setCurrentUserTimetable] = useState<Record<string, ClassItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [isFriend, setIsFriend] = useState<boolean>(false);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [plannerPreFill, setPlannerPreFill] = useState<{ date?: string, time?: string }>({});
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    const loadAllData = async () => {
      if (!resolvedId) return;
      setLoading(true);
      try {
        const [rawTimetable, enhancedProfile, profile, myTimetable, blockedList] = await Promise.all([
          getFriendTimetable(resolvedId),
          getEnhancedFriendProfile(resolvedId),
          getProfile(resolvedId),
          loadTimetable(),
          getBlockedUsers()
        ]);

        setIsBlocked(blockedList.includes(resolvedId));

        setFriendTimetable(rawTimetable || {});
        setEnhanced(enhancedProfile || null);
        setProfileDoc(profile || null);
        setCurrentUserTimetable(myTimetable || {});

        const arr: Array<{ day: string; time: string; title: string; where?: string }> = [];
        Object.entries(rawTimetable || {}).forEach(([day, classes]) => {
          (classes as ClassItem[]).forEach((c) => {
            arr.push({
              day,
              time: c.time,
              title: c.title || c.course,
              where: c.location || c.academicBlock
            });
          });
        });
        if (arr.length > 0) setLatestTimetable(arr);
      } catch (e) {
        console.warn('Failed to load friend data', e);
      } finally {
        setLoading(false);
      }
    };
    loadAllData();
  }, [resolvedId]);

  useEffect(() => {
    if (!resolvedId) return;
    const unsubscribe = getFriends((friendsList) => {
      setIsFriend(friendsList.some(f => f.uid === resolvedId));
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [resolvedId]);

  const displayName = profileDoc?.name || resolvedUser?.name || formatEmailToName(resolvedUser?.displayName || resolvedUser?.email);
  const initials = displayName ? displayName.charAt(0).toUpperCase() : '';
  const displayMajor = profileDoc?.major ?? enhanced?.major ?? resolvedUser?.major ?? '';
  const displayYear = profileDoc?.year ?? enhanced?.year ?? resolvedUser?.year ?? '';
  const displayUniversity = profileDoc?.university ?? enhanced?.university ?? resolvedUser?.university ?? '';
  const displayBio = profileDoc?.bio ?? enhanced?.bio ?? resolvedUser?.bio ?? '';
  const displayInterests = (profileDoc?.interests ?? enhanced?.interests ?? resolvedUser?.interests ?? []).filter(Boolean);
  const displayClubs = (profileDoc?.clubs ?? enhanced?.clubs ?? resolvedUser?.clubs ?? []).filter(Boolean);
  const photoURL = profileDoc?.photoURL || (resolvedUser as any)?.photoURL;

  // Timetable processing
  const scheduleItems = useMemo(() => {
    return latestTimetable.map((item, idx) => ({
      key: `item-${idx}`,
      day: item.day,
      time: item.time,
      title: item.title,
      place: item.where || 'TBD',
    }));
  }, [latestTimetable]);

  const scheduleByDay = useMemo(() => {
    const parseStart = (maybeTime?: string) => {
      if (!maybeTime) return 24 * 60;
      const m12 = maybeTime.match(/^([0-9]{1,2}):([0-9]{2})\s*(AM|PM)$/i);
      if (m12) {
        let hh = parseInt(m12[1], 10);
        const mm = parseInt(m12[2], 10);
        const ap = m12[3].toUpperCase();
        if (ap === 'AM' && hh === 12) hh = 0;
        if (ap === 'PM' && hh !== 12) hh += 12;
        return hh * 60 + mm;
      }
      return 24 * 60;
    };

    const grouped = {} as Record<DayKey, typeof scheduleItems>;
    WEEKDAYS.forEach(day => grouped[day] = []);
    scheduleItems.forEach(item => {
      const key = (item.day || '').slice(0, 3).toUpperCase() as DayKey;
      if (grouped[key]) grouped[key].push(item);
    });
    WEEKDAYS.forEach(day => {
      grouped[day] = [...grouped[day]].sort((a, b) => parseStart(a.time) - parseStart(b.time));
    });
    return grouped;
  }, [scheduleItems]);

  const bothFreeNow = useMemo(() => {
    return isBothFreeNow(currentUserTimetable, friendTimetable);
  }, [currentUserTimetable, friendTimetable]);

  const todayKey = getTodayKey();

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-sky-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500 font-medium">Syncing profile...</p>
        </div>
      </div>
    );
  }

  const isGhost = profileDoc?.privacySettings?.ghostMode === true;
  const isTimetableVisible = profileDoc?.privacySettings?.timetableVisible !== false && !isGhost;

  if (isGhost) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 flex flex-col font-sans text-slate-800 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-[calc(2.5rem+env(safe-area-inset-top))] px-6" style={{fontFamily: "'Inter', sans-serif"}}>
        <nav className="mb-8">
          <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200 transition active:scale-90">
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>
        </nav>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-24 h-24 mb-6 rounded-full bg-slate-200 flex items-center justify-center">
            <UserPlus className="h-10 w-10 text-slate-400 opacity-50" />
          </div>
          <h2 className="text-2xl font-bold text-slate-700 mb-2">Profile Unavailable</h2>
          <p className="text-slate-500 max-w-xs">This user has enabled Ghost Mode or their profile is currently private.</p>
        </div>
      </div>
    );
  }

  // Filter tabs based on privacy
  const visibleTabs = tabLabels.filter(tab => {
    if ((tab.id === 'schedule' || tab.id === 'mutual') && !isTimetableVisible) return false;
    return true;
  });

  // Ensure active tab is valid
  if ((activeTab === 'schedule' || activeTab === 'mutual') && !isTimetableVisible) {
    setActiveTab('clubs');
  }

  return (
    <>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-[calc(5rem+env(safe-area-inset-bottom))]" style={{fontFamily: "'Inter', sans-serif"}}>
        {/* Ambient background blurs */}
        <div aria-hidden className="pointer-events-none fixed -top-64 left-[234px] w-96 h-96 bg-sky-400/5 rounded-full blur-[120px]" />
        <div aria-hidden className="pointer-events-none fixed bottom-0 -left-48 w-96 h-96 bg-violet-500/5 rounded-full blur-[120px]" />

        {/* Navigation Bar */}
        <nav className="sticky top-0 z-[1000] border-b border-white/40 bg-white/60 px-4 py-4 backdrop-blur-xl sm:px-6">
          <div className="mx-auto flex max-w-2xl items-center justify-between">
            <button
              onClick={onBack}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200 transition active:scale-90"
            >
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </button>
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Profile</h2>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200 transition active:scale-90 outline-none">
                  <Info className="h-5 w-5 text-slate-600" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl p-1 shadow-lg border-slate-100">
                <DropdownMenuItem 
                  className="rounded-lg text-rose-600 font-semibold focus:text-rose-700 focus:bg-rose-50 cursor-pointer"
                  onClick={async () => {
                    if (resolvedId) {
                      try {
                        if (isBlocked) {
                          await unblockUser(resolvedId);
                          setIsBlocked(false);
                          toast.success('User unblocked');
                        } else {
                          await blockUser(resolvedId);
                          setIsBlocked(true);
                          toast.success('User blocked');
                        }
                      } catch (error) {
                        toast.error(isBlocked ? 'Failed to unblock' : 'Failed to block');
                      }
                    }
                  }}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  {isBlocked ? 'Unblock User' : 'Block User'}
                </DropdownMenuItem>
                <div className="h-px bg-slate-100 my-1" />
                <DropdownMenuItem 
                  className="rounded-lg text-amber-600 font-semibold focus:text-amber-700 focus:bg-amber-50 cursor-pointer"
                  onClick={async () => {
                    if (resolvedId) {
                      try {
                        await submitReport(resolvedId);
                        toast.success('Report submitted', { description: 'We will review this user shortly.' });
                      } catch (error) {
                        toast.error('Failed to submit report');
                      }
                    }
                  }}
                >
                  <Flag className="mr-2 h-4 w-4" />
                  Report User
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </nav>

        {/* Main Content */}
        <section className="mx-auto max-w-2xl px-6 pt-8">
          {/* Header / Avatar Section */}
          <header className="mb-12 flex flex-col items-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 animate-pulse rounded-full bg-sky-400/20 blur-2xl" />
              <Avatar className="h-32 w-32 border-4 border-white shadow-2xl relative z-10">
                <AvatarImage src={photoURL} />
                <AvatarFallback className="bg-sky-100 text-4xl font-bold text-sky-700">{initials}</AvatarFallback>
              </Avatar>
            </div>

            <div className="mt-3 text-center">
              <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight" style={{fontFamily: "'Plus Jakarta Sans', sans-serif"}}>
                {displayName}
              </h1>
              <p className="mt-1 text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
                {displayMajor} • {displayYear?.includes('Class') ? displayYear : (displayYear?.match(/^\d{4}$/) ? `Class of '${displayYear.slice(2)}` : `Year ${displayYear}`)}
              </p>
              {displayBio && (
                <p className="mt-3 max-w-sm mx-auto text-sm leading-relaxed text-slate-600 italic px-6">
                  "{displayBio}"
                </p>
              )}
            </div>

            <div className="mt-5 w-full flex gap-3 max-w-sm">
              <Button
                onClick={async () => {
                  if (resolvedId) {
                    await createConversation(resolvedId);
                    if (onMessage) onMessage();
                  }
                }}
                className="h-11 flex-1 rounded-2xl bg-sky-400 text-sm font-bold text-white shadow-[0_10px_15px_-3px_rgba(56,189,248,0.3),0_4px_6px_-4px_rgba(56,189,248,0.3)] hover:bg-sky-500"
              >
                <MessageSquare className="mr-2 h-4 w-4" /> Message
              </Button>
              {isFriend ? (
                <div className="flex-1 flex items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 font-bold text-sm border border-emerald-100 shadow-sm">
                  <Star className="mr-1.5 h-3.5 w-3.5 fill-current" /> Friends
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="h-11 flex-1 rounded-2xl border-sky-400/20 bg-white text-sm font-bold text-sky-600 hover:bg-sky-50"
                  onClick={async () => {
                    if (resolvedId) {
                      try {
                        const { sendFriendRequest } = await import('../../../utils/firebase/firestore');
                        await sendFriendRequest(resolvedId);
                        toast.success('Friend request sent!', { description: `${displayName} will see your request.` });
                      } catch (error) {
                        console.error('Failed to send friend request:', error);
                        toast.error('Failed to send friend request');
                      }
                    } else {
                      toast.error('Unable to send request — profile not loaded');
                    }
                  }}
                >
                  <UserPlus className="mr-2 h-4 w-4" /> Add Friend
                </Button>
              )}
            </div>
          </header>

          <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
            <InfoChip icon={Globe2} label="Campus" value={displayUniversity} />
            <InfoChip icon={MapPin} label="Major" value={displayMajor} />
            <InfoChip icon={Sparkles} label="Year" value={displayYear} />
          </div>

          <nav className="mt-6">
            <div className="flex items-center justify-between rounded-2xl bg-white/60 p-1 ring-1 ring-sky-400/10 overflow-x-auto no-scrollbar">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 min-w-[80px] rounded-xl px-2 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-sky-400 text-white shadow-[0_4px_6px_-4px_rgba(56,189,248,0.3)]'
                      : 'text-slate-600 hover:bg-sky-50'
                  }`}
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </nav>

          <section className="mt-6">
            {activeTab === 'schedule' && (
              <div className="space-y-4">
                {Object.keys(scheduleByDay).length === 0 ? (
                  <div className="rounded-[1.25rem] bg-white/60 ring-1 ring-sky-400/10 p-4 text-center">
                    <p className="text-sm font-semibold text-slate-800">No schedule shared</p>
                  </div>
                ) : (
                  WEEKDAYS.map((day) => {
                    const items = scheduleByDay[day];
                    const isToday = todayKey === day;
                    return (
                      <div
                        key={day}
                        className={`rounded-[1.25rem] p-4 ring-1 transition ${
                          isToday ? 'bg-white ring-sky-400/40 shadow-sm' : 'bg-white/60 ring-sky-400/10'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className={`text-sm font-extrabold tracking-tight ${isToday ? 'text-sky-600' : 'text-slate-800'}`}>
                            {day} {isToday && <span className="ml-2 text-[9px] font-bold uppercase tracking-widest text-sky-500 align-middle">Today</span>}
                          </h3>
                        </div>
                        {items.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">No classes.</p>
                        ) : (
                          <div className="space-y-3">
                            {items.map((item, i) => (
                              <div key={i} className="flex gap-3">
                                <div className="mt-1 h-4 w-4 shrink-0 rounded-full border-[3px] border-white bg-sky-400 shadow-sm" />
                                <div className="flex-1">
                                  <h4 className="text-sm font-bold text-slate-800 leading-tight">{item.title}</h4>
                                  <div className="mt-1 flex items-center gap-3 text-slate-500">
                                    <span className="text-[11px] font-medium flex items-center gap-1"><Clock3 className="h-3 w-3" /> {item.time}</span>
                                    <span className="text-[11px] font-medium flex items-center gap-1"><MapPin className="h-3 w-3" /> {item.place}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === 'mutual' && (
              <MutualFreeTime 
                currentUserTimetable={currentUserTimetable}
                friendTimetable={friendTimetable}
                friendName={displayName}
                onStartChat={async () => {
                  if (resolvedId) {
                    await createConversation(resolvedId);
                    if (onMessage) onMessage();
                  }
                }}
                onPlanHangout={(details) => {
                  setPlannerPreFill(details);
                  setPlannerOpen(true);
                }}
              />
            )}

            {activeTab === 'clubs' && (
              <div className="space-y-4">
                <div className="p-4 bg-white/60 rounded-2xl ring-1 ring-sky-400/10">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">About</h3>
                  <p className="text-sm leading-relaxed text-slate-600 italic">"{displayBio || 'No bio added yet.'}"</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {displayInterests.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No clubs joined yet.</p>
                  ) : (
                    displayInterests.map((interest: string, i: number) => (
                      <span key={i} className="rounded-full bg-sky-400/10 px-3 py-1.5 text-sm font-medium text-sky-600 ring-1 ring-sky-400/20">
                        {interest}
                      </span>
                    ))
                  )}
                </div>
              </div>
            )}
          </section>
        </section>
      </div>

      <HangoutPlanner
        open={plannerOpen}
        onOpenChange={setPlannerOpen}
        initialSelectedFriendId={resolvedId}
        initialDate={plannerPreFill.date}
        initialTime={plannerPreFill.time}
      />
    </>
  );
}

function InfoChip({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-[1.5rem] bg-white/60 p-3 ring-1 ring-sky-400/10 transition-colors hover:bg-white">
      <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-sky-400/10 text-sky-500">
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
      <span className="mt-0.5 text-xs font-bold text-slate-700 truncate w-full text-center px-1">{value}</span>
    </div>
  );
}
