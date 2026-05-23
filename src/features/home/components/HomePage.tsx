import React, { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-gesture-handling';
import 'leaflet-gesture-handling/dist/leaflet-gesture-handling.css';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import { Coffee, LibraryBig, LocateFixed, MapPin, Plus, Radio, SmilePlus, Sparkles, Users, X, Clock, Unlock, Lock, Zap, GraduationCap, Utensils, BookOpen, PartyPopper, Dribbble } from 'lucide-react';
import { auth, isFirebaseConfigured } from '../../../utils/firebase/client';
import {
  createConversation,
  getCheckIns,
  getCurrentLocation,
  getFriendLocations,
  getPulses,
  getUpcomingEventsRealtime,
  updateUserLocation,
  getActiveAds,
  recordAdImpression,
  recordAdClick,
  type CheckIn,
  type FriendLocation,
  type Pulse,
  type Advertisement,
  type CampusEvent,
  requestToJoinPulse,
  sendMessage,
  getUserProfile,
  getProfile,
  getFriends,
  type UserProfile
} from '../../../utils/firebase/firestore';
import { PulseSheet } from './PulseSheet';
import { HangoutPlanner } from '../../timetable/components/HangoutPlanner';
import { CheckInSheet } from '../../../components/common/CheckInSheet';
import { WhosAroundPanel } from './WhosAroundPanel';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../../components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useUniversity } from '../../../hooks/useUniversity';
import { getMapLocationName } from '../../../utils/mapUtils';
import { registerBackHandler } from '../../../utils/backButton';

type HomePageProps = {
  currentUser?: {
    name?: string;
    displayName?: string;
    photoURL?: string;
    location?: { name?: string } | null;
  };
  onOpenProfile?: (user: any) => void;
  onNavigate?: (page: string) => void;
};

export function HomePage({ currentUser, onOpenProfile, onNavigate }: HomePageProps) {
  const university = useUniversity();
  const [mapCenter, setMapCenter] = useState({ lat: university.mapCenter[0], lng: university.mapCenter[1] });
  const [mapLabel, setMapLabel] = useState(currentUser?.location?.name || university.campusLabel);
  const [liveFriendLocations, setLiveFriendLocations] = useState<FriendLocation[]>([]);
  const [nearbyEvents, setNearbyEvents] = useState<CampusEvent[]>([]);

  const firstName =
    currentUser?.name?.split(' ')[0] ||
    currentUser?.displayName?.split(' ')[0] ||
    'You';

  const myPhoto = currentUser?.photoURL || (auth.currentUser as any)?.photoURL || undefined;
  const myInitial = (firstName.charAt(0) || 'U').toUpperCase();
  // Derived after VIBE_OPTIONS is declared below (see useMemo)

  useEffect(() => {
    const loadMap = async () => {
      try {
        const position = await getCurrentLocation();
        setMapCenter(position);
        
        // Auto-fetch nearest name of the place from the map API
        const locationName = await getMapLocationName(position.lat, position.lng);
        setMapLabel(locationName);

        if (isFirebaseConfigured && auth.currentUser?.emailVerified) {
          await updateUserLocation({
            lat: position.lat,
            lng: position.lng,
            name: locationName,
          });
        }
      } catch {
        setMapLabel(currentUser?.location?.name || university.campusLabel);
      }
    };

    loadMap();
  }, [currentUser?.location?.name]);

  useEffect(() => {
    if (!(isFirebaseConfigured && auth.currentUser?.emailVerified)) return;
    const unsubscribe = getFriendLocations((locations) => {
      setLiveFriendLocations(locations);
    }, university.id);
    const unsubscribeEvents = getUpcomingEventsRealtime((events) => {
      setNearbyEvents(events.slice(0, 3));
    }, university.id);
    return () => {
      unsubscribe();
      unsubscribeEvents();
    };
  }, [university.id]);

  // ---- FEATURE 1: Pulses + FEATURE 5: Check-ins ----------------------------
  const [pulseSheetOpen, setPulseSheetOpen] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [checkinSheetOpen, setCheckinSheetOpen] = useState(false);
  const [whosAroundOpen, setWhosAroundOpen] = useState(false);
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [activeAds, setActiveAds] = useState<Advertisement[]>([]);
  const [selectedAd, setSelectedAd] = useState<Advertisement | null>(null);

  // Set Vibe — local quick picker (no sheet, no persistence — just a visible tag)
  const [currentVibe, setCurrentVibe] = useState<string | null>(null);
  const [selectedPulseForJoin, setSelectedPulseForJoin] = useState<Pulse | null>(null);
  const [isJoiningPulse, setIsJoiningPulse] = useState(false);
  const [pulseCreatorName, setPulseCreatorName] = useState<string>('');
  const [joinMessage, setJoinMessage] = useState<string>('');
  const [friends, setFriends] = useState<UserProfile[]>([]);


  useEffect(() => {
    if (!isFirebaseConfigured || !auth.currentUser) return;
    const unsub = getFriends((data) => setFriends(data));
    return () => unsub();
  }, []);

  useEffect(() => {
    return registerBackHandler(() => {
      if (selectedAd) {
        setSelectedAd(null);
        return true;
      }
      if (selectedPulseForJoin) {
        setSelectedPulseForJoin(null);
        return true;
      }
      if (pulseSheetOpen) {
        setPulseSheetOpen(false);
        return true;
      }
      if (plannerOpen) {
        setPlannerOpen(false);
        return true;
      }
      if (checkinSheetOpen) {
        setCheckinSheetOpen(false);
        return true;
      }
      if (whosAroundOpen) {
        setWhosAroundOpen(false);
        return true;
      }
      return false;
    });
  }, [
    selectedAd,
    selectedPulseForJoin,
    pulseSheetOpen,
    plannerOpen,
    checkinSheetOpen,
    whosAroundOpen,
  ]);

  const VIBE_OPTIONS = [
    { id: 'class', label: 'Class', emoji: '🎓' },
    { id: 'food', label: 'Food', emoji: '🍔' },
    { id: 'library', label: 'Library', emoji: '📚' },
    { id: 'fun', label: 'Fun', emoji: '🎉' },
    { id: 'sports', label: 'Sports', emoji: '⚽' },
  ] as const;

  const currentVibeEmoji = useMemo(
    () => VIBE_OPTIONS.find((v) => v.id === currentVibe)?.emoji,
    [currentVibe]
  );

  // "Campus is buzzing" welcome card — auto-hide after 4s
  const [buzzVisible, setBuzzVisible] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setBuzzVisible(false), 4000);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const unsubP = getPulses((list) => setPulses(list), university.id);
    const unsubC = getCheckIns((list) => setCheckins(list), university.id);
    const unsubA = getActiveAds((list) => {
      // Filter ads by current university (or global ads with no target)
      const filteredAds = list.filter(ad => !ad.targetUniversityId || ad.targetUniversityId === university.id);
      setActiveAds(filteredAds);
      // Record impressions for new ads
      filteredAds.forEach(ad => {
        if (ad.id) recordAdImpression(ad.id);
      });
    });
    return () => { 
      unsubP && unsubP(); 
      unsubC && unsubC(); 
      unsubA && unsubA();
    };
  }, [university.id]);

  const myUid = auth.currentUser?.uid;
  const activePulses = useMemo(() => {
    if (!pulses) return [];

    // Enforce privacy: pulse must be public OR belong to a friend OR belong to the current user
    const validPulses = pulses.filter(p => {
      if (p.isPublic !== false) return true; // Default to public if undefined
      if (p.createdBy === myUid) return true; // Always see your own
      // If private, ensure the creator is in the current user's friends list
      return friends.some(f => f.uid === p.createdBy);
    });

    return validPulses.sort((a, b) => {
      if (a.createdBy === myUid) return -1;
      if (b.createdBy === myUid) return 1;
      return 0;
    });
  }, [pulses, myUid, friends]);

  const openDmWithUser = async (otherUid: string) => {
    try {
      await createConversation(otherUid);
    } catch (e) {
      console.error('DM open failed', e);
    }
    onNavigate?.('messages');
  };

  // Fetch creator name when a pulse is selected for joining
  useEffect(() => {
    if (!selectedPulseForJoin) { setPulseCreatorName(''); setJoinMessage(''); return; }
    // Set default message immediately
    setJoinMessage(`I wanted to join with you for "${selectedPulseForJoin.text}"`);
    let cancelled = false;
    // Fetch from both collections — profiles has the registered name, users has displayName
    Promise.all([
      getProfile(selectedPulseForJoin.createdBy).catch(() => null),
      getUserProfile(selectedPulseForJoin.createdBy).catch(() => null),
    ]).then(([profileDoc, userDoc]) => {
      if (cancelled) return;
      const name = (profileDoc as any)?.name
        || (userDoc as any)?.displayName
        || (userDoc as any)?.name
        || 'Someone';
      setPulseCreatorName(name);
    });
    return () => { cancelled = true; };
  }, [selectedPulseForJoin]);

  const VIBE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    class: { label: 'Class', icon: <GraduationCap className="h-4 w-4" />, color: 'bg-blue-50 text-blue-600' },
    food: { label: 'Food', icon: <Utensils className="h-4 w-4" />, color: 'bg-orange-50 text-orange-600' },
    library: { label: 'Library', icon: <BookOpen className="h-4 w-4" />, color: 'bg-emerald-50 text-emerald-600' },
    fun: { label: 'Fun', icon: <PartyPopper className="h-4 w-4" />, color: 'bg-pink-50 text-pink-600' },
    sports: { label: 'Sports', icon: <Dribbble className="h-4 w-4" />, color: 'bg-violet-50 text-violet-600' },
  };

  const getTimeRemaining = (expiresAt: any) => {
    const expMs = expiresAt?.toMillis?.() || expiresAt?.seconds * 1000 || 0;
    const diff = expMs - Date.now();
    if (diff <= 0) return 'Expired';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m left`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m left`;
  };

  const handleJoinPulse = async (pulse: Pulse) => {
    if (!pulse.id && !pulse.createdBy) return;
    const pulseId = pulse.id || pulse.createdBy;
    const msg = joinMessage || `I wanted to join with you for "${pulse.text}"`;

    // Close modal and show success immediately
    setSelectedPulseForJoin(null);
    setIsJoiningPulse(false);
    toast.success('Join request sent!');

    // Run all writes in the background — don't block the UI
    (async () => {
      try {
        await requestToJoinPulse(pulseId);
        const convId = await createConversation(pulse.createdBy);
        if (convId) {
          await sendMessage(convId, msg);
        }
      } catch (e) {
        console.error('Failed to complete pulse join flow:', e);
      }
    })();
  };


  // Map a check-in's free-text location to absolute coordinates
  // so friends' check-ins appear as pins at their real locations.
  const locationCoordinates: Record<string, { lat: number; lng: number }> = {
     'SJT': { lat: 12.970926, lng: 79.163833 },
     'PRP': { lat: 12.971493, lng: 79.165726 },
     'MGB': { lat: 12.972128, lng: 79.167910 },
     'MB': { lat: 12.969457, lng: 79.155872 },
     'Foodys': { lat: 12.968984, lng: 79.158337 },
     'TT': { lat: 12.970605, lng: 79.159520 },
      'Library': { lat: 12.969345, lng: 79.156821 },
    };

  const checkinPins = useMemo(() => (
    checkins
      .filter((c) => c.createdBy !== myUid)
      .map((c) => {
        const coords = locationCoordinates[c.location];
        if (!coords) return null;
        
        return {
          id: c.id || c.createdBy,
          uid: c.createdBy,
          location: c.location,
          lat: coords.lat,
          lng: coords.lng,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
  ), [checkins, myUid]);

  const visibleMarkers = liveFriendLocations.map((friend) => ({
    id: friend.uid,
    name: friend.displayName || 'Friend',
    vibe: friend.location?.name || 'On campus',
    image: friend.photoURL || 'https://ui-avatars.com/api/?name=' + (friend.displayName || 'Friend'),
    accent: 'ring-sky-400/60',
    lat: friend.location?.lat,
    lng: friend.location?.lng,
  }));

  const markerData = useMemo(
    () =>
      visibleMarkers.map((friend) => ({
        ...friend,
        icon: createAvatarIcon(friend.image, friend.accent),
      })),
    [visibleMarkers]
  );

  return (
    <div className="campus-pulse-shell relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.75),_rgba(241,247,251,0.2)_35%,_rgba(9,15,18,0.12)_100%)] text-slate-900">
      <div className="absolute inset-0 isolate z-0">
        <MapContainer
          center={[mapCenter.lat, mapCenter.lng]}
          zoom={16}
          zoomControl={false}
          touchZoom={true}
          doubleClickZoom={true}
          dragging={true}
          // @ts-ignore - plugin option
          gestureHandling={false}
          className="h-full w-full"
        >
          {import.meta.env.VITE_MAPBOX_TOKEN ? (
            <TileLayer
              attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${import.meta.env.VITE_MAPBOX_TOKEN}`}
            />
          ) : (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          )}
          <MapViewport center={mapCenter} markers={markerData} />
          {myPhoto ? (
            <Marker
              position={[mapCenter.lat, mapCenter.lng]}
              icon={createMyAvatarIcon(myPhoto, currentVibeEmoji)}
              eventHandlers={{ click: () => onNavigate?.('profile') }}
            />
          ) : (
            <Marker
              position={[mapCenter.lat, mapCenter.lng]}
              icon={createMyInitialIcon(myInitial, currentVibeEmoji)}
              eventHandlers={{ click: () => onNavigate?.('profile') }}
            />
          )}
          {markerData.map((friend) => (
            <Marker
              key={friend.id}
              position={[friend.lat, friend.lng]}
              icon={friend.icon}
              eventHandlers={{
                click: () => onOpenProfile?.({ id: friend.id, name: friend.name, bio: friend.vibe, photoURL: friend.image }),
              }}
            />
          ))}
          {/* FEATURE 5 — Friend check-in pins */}
          {checkinPins.map((pin) => (
            <Marker
              key={`checkin-${pin.id}`}
              position={[pin.lat, pin.lng]}
              icon={createCheckinIcon(pin.location)}
              eventHandlers={{
                click: () => openDmWithUser(pin.uid),
              }}
            />
          ))}
          {/* MONETIZATION — Map-based Ads */}
          {activeAds.map((ad) => (
            <Marker
              key={`ad-${ad.id}`}
              position={[ad.location.lat, ad.location.lng]}
              icon={createAdIcon(ad.brandName, ad.imageUrl || (ad as any).bannerUrl || '', ad.bannerText)}
              eventHandlers={{
                click: () => {
                  if (ad.id) recordAdImpression(ad.id); // Counting it as a "click into details"
                  setSelectedAd(ad);
                },
              }}
            />
          ))}
        </MapContainer>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(246,251,255,0.64)_0%,rgba(241,247,251,0.06)_38%,rgba(241,247,251,0.58)_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(45,183,242,0.22),transparent_28%),radial-gradient(circle_at_80%_30%,rgba(167,169,255,0.2),transparent_26%),radial-gradient(circle_at_50%_100%,rgba(255,255,255,0.85),transparent_38%)]" />
      </div>

      <header className="absolute inset-x-0 top-0 z-[1000] px-4 pt-4 sm:px-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => onNavigate?.('profile')}
            className="flex items-center gap-3 rounded-full border border-white/60 bg-white/72 px-2 py-2 shadow-[0_18px_45px_rgba(41,48,51,0.12)] backdrop-blur-xl transition hover:scale-[0.99]"
          >
            <span className="campus-live-ring flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-sky-500 to-cyan-300 text-sm font-bold text-white">
              {myPhoto ? (
                <img src={myPhoto} alt={firstName} className="h-full w-full object-cover" />
              ) : (
                <>{firstName.charAt(0)}</>
              )}
            </span>
            <span className="hidden pr-3 text-left sm:block">
              <span className="block text-xs font-semibold uppercase tracking-[0.24em] text-sky-600/80">
                UniNest
              </span>
              <span className="block text-sm font-semibold text-slate-800">{firstName}'s pulse</span>
            </span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="campus-vibe-pill inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-sky-700 shadow-[0_16px_40px_rgba(0,98,134,0.12)] transition hover:scale-[0.99]"
                data-testid="set-vibe-btn"
              >
                {currentVibe ? (
                  <>
                    <span className="text-base leading-none">
                      {VIBE_OPTIONS.find((v) => v.id === currentVibe)?.emoji}
                    </span>
                    <span className="capitalize">{currentVibe}</span>
                  </>
                ) : (
                  <>
                    <SmilePlus className="h-4 w-4" />
                    Set Vibe
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="z-[1001] w-44 rounded-2xl border border-white/60 bg-white/95 p-1.5 shadow-[0_18px_45px_rgba(41,48,51,0.18)] backdrop-blur-xl"
              data-testid="set-vibe-menu"
            >
              {VIBE_OPTIONS.map((v) => (
                <DropdownMenuItem
                  key={v.id}
                  onClick={() => {
                    setCurrentVibe(v.id);
                    toast.success(`Vibe set to ${v.label}`, { description: 'Friends will see this on your profile.' });
                  }}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:bg-sky-50 focus:text-sky-700"
                  data-testid={`vibe-option-${v.id}`}
                >
                  <span className="text-base">{v.emoji}</span>
                  <span>{v.label}</span>
                </DropdownMenuItem>
              ))}
              {currentVibe && (
                <DropdownMenuItem
                  onClick={() => {
                    setCurrentVibe(null);
                    toast('Vibe cleared');
                  }}
                  className="mt-1 flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 focus:bg-slate-100"
                  data-testid="vibe-option-clear"
                >
                  Clear vibe
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/75 px-3 py-2 text-xs font-semibold text-slate-700 shadow-[0_12px_30px_rgba(41,48,51,0.08)] backdrop-blur-xl">
          <LocateFixed className="h-3.5 w-3.5 text-sky-600" />
          {mapLabel}
        </div>

        {/* FEATURE 1 — Active friend pulses (horizontal pill strip) */}
        {activePulses.length > 0 && (
          <div className="mt-3 -mx-1 flex items-center gap-2 overflow-x-auto pb-1" data-testid="pulse-strip">
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-sky-700 backdrop-blur-xl">
              <Radio className="h-3 w-3 animate-pulse" /> Live
            </span>
            {activePulses.slice(0, 12).map((p) => {
              const isMine = p.createdBy === myUid;
              return (
                <button
                  key={p.id || p.createdBy}
                  type="button"
                  onClick={() => {
                    setSelectedPulseForJoin(p);
                  }}
                  className={`shrink-0 max-w-[240px] truncate rounded-full border px-3 py-1.5 text-xs font-semibold shadow-[0_10px_24px_rgba(41,48,51,0.08)] backdrop-blur-xl transition hover:bg-white ${
                    isMine 
                      ? 'border-sky-300 bg-sky-50 text-sky-800' 
                      : 'border-white/60 bg-white/80 text-slate-700'
                  }`}
                  data-testid={`pulse-pill-${p.createdBy}`}
                  title={p.text}
                >
                  <Sparkles className={`mr-1 inline h-3 w-3 ${isMine ? 'text-sky-600' : 'text-sky-500'}`} />
                  {isMine ? 'You: ' : ''}{p.text}
                </button>
              );
            })}
          </div>
        )}

        {/* Pulse Detail + Join Modal */}
        {selectedPulseForJoin && (() => {
          const p = selectedPulseForJoin;
          const isMine = p.createdBy === myUid;
          const vibeMeta = VIBE_META[p.vibe || ''] || { label: p.vibe || 'Hangout', icon: <Zap className="h-4 w-4" />, color: 'bg-sky-50 text-sky-600' };
          const timeLeft = getTimeRemaining(p.expiresAt);
          return (
            <div className="fixed inset-0 z-[2000] flex flex-col bg-white animate-in slide-in-from-bottom duration-300" onClick={(e) => e.stopPropagation()}>
              <div
                className="flex-1 flex flex-col h-full overflow-y-auto no-scrollbar"
              >
                {/* Header gradient bar */}
                <div className="relative bg-gradient-to-br from-sky-500 to-cyan-400 px-6 pt-12 pb-8 text-white shrink-0">
                  <button onClick={() => setSelectedPulseForJoin(null)} className="absolute top-12 right-6 h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/40 transition backdrop-blur-md">
                    <X className="h-5 w-5" />
                  </button>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest bg-white/20 text-white backdrop-blur-md">
                      <Radio className="h-3.5 w-3.5 animate-pulse" /> Live
                    </span>
                    <span className="text-[11px] font-bold text-white/80 uppercase tracking-widest">{timeLeft} remaining</span>
                  </div>
                  <h3 className="text-3xl font-black text-white leading-tight mb-2">"{p.text}"</h3>
                  <p className="text-base font-bold text-white/70 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    by {pulseCreatorName || 'Loading...'}
                  </p>
                </div>

                {/* Info Section — Clean Grid */}
                <div className="flex-1 p-6 space-y-8">
                  <div className="space-y-4">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Pulse Details</p>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Vibe */}
                      <div className={`flex flex-col gap-2 rounded-[24px] p-5 ${vibeMeta.color} border border-black/5 shadow-sm`}>
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Vibe</p>
                          {React.cloneElement(vibeMeta.icon as React.ReactElement, { className: 'h-4 w-4 opacity-70' })}
                        </div>
                        <p className="text-base font-extrabold capitalize">{vibeMeta.label}</p>
                      </div>
                      {/* Crowd */}
                      <div className="flex flex-col gap-2 rounded-[24px] p-5 bg-slate-50 text-slate-700 border border-slate-200/50 shadow-sm">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Crowd</p>
                          <Users className="h-4 w-4 opacity-40" />
                        </div>
                        <p className="text-base font-extrabold">{p.crowdMin ?? 1}–{p.crowdMax ?? 5} people</p>
                      </div>
                      {/* Duration */}
                      <div className="flex flex-col gap-2 rounded-[24px] p-5 bg-slate-50 text-slate-700 border border-slate-200/50 shadow-sm">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Duration</p>
                          <Clock className="h-4 w-4 opacity-40" />
                        </div>
                        <p className="text-base font-extrabold">{p.durationMinutes ?? 30}m</p>
                      </div>
                      {/* Visibility */}
                      <div className="flex flex-col gap-2 rounded-[24px] p-5 bg-slate-50 text-slate-700 border border-slate-200/50 shadow-sm">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Visibility</p>
                          {p.isPublic !== false ? <Unlock className="h-4 w-4 opacity-40" /> : <Lock className="h-4 w-4 opacity-40" />}
                        </div>
                        <p className="text-base font-extrabold">{p.isPublic !== false ? 'Public' : 'Private'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Editable join message or Status for owner */}
                  {!isMine ? (
                    <div className="rounded-[28px] bg-sky-50/50 border border-sky-100 p-6">
                      <p className="text-xs font-black uppercase tracking-widest text-sky-500 mb-3">Your message</p>
                      <textarea
                        value={joinMessage}
                        onChange={(e) => setJoinMessage(e.target.value)}
                        rows={3}
                        className="w-full bg-white rounded-2xl border border-sky-100 px-4 py-3 text-base text-slate-800 font-medium resize-none focus:outline-none focus:ring-4 focus:ring-sky-400/20 focus:border-sky-300 transition-all placeholder:text-slate-300 shadow-inner"
                        placeholder="Say something to join..."
                      />
                    </div>
                  ) : (
                    <div className="rounded-[28px] bg-emerald-50/50 border border-emerald-100 p-8 text-center">
                      <div className="flex items-center justify-center gap-3 mb-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-sm text-white shadow-lg shadow-emerald-200">⚡</span>
                        <p className="text-lg font-black text-emerald-700">Active Pulse</p>
                      </div>
                      <p className="text-sm text-emerald-600/80 font-medium">Friends can see this and request to join your activity.</p>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="p-6 pb-12 bg-white border-t border-slate-100 flex gap-4 shrink-0">
                  <button
                    onClick={() => setSelectedPulseForJoin(null)}
                    className="flex-1 h-14 rounded-2xl bg-slate-100 text-base font-bold text-slate-500 transition hover:bg-slate-200 active:scale-95"
                  >
                    {isMine ? 'Done' : 'Cancel'}
                  </button>
                  {!isMine && (
                    <button
                      onClick={() => handleJoinPulse(selectedPulseForJoin)}
                      disabled={isJoiningPulse}
                      className="flex-[2] h-14 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-500 text-base font-black text-white shadow-xl shadow-sky-500/25 transition hover:shadow-2xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isJoiningPulse ? 'Sending Request...' : 'Join Pulse ⚡'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      </header>

      <aside className="absolute left-4 top-24 z-[999] hidden w-72 space-y-4 xl:block">
        <section className="campus-glass-card rounded-[28px] p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-slate-900">Nearby Events</p>
            <button 
              onClick={() => onNavigate?.('discover')}
              className="text-[10px] font-bold text-sky-600 uppercase tracking-widest hover:text-sky-700"
            >
              See all
            </button>
          </div>
          <div className="space-y-3">
            {nearbyEvents.length > 0 ? (
              nearbyEvents.map((event) => {
                return (
                  <div key={event.id} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{event.title}</p>
                      <p className="text-[11px] text-slate-500 truncate">{event.location} • {event.clubName}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-slate-400 italic py-2">No live events nearby.</p>
            )}
          </div>
        </section>

        <section className="campus-glass-card flex items-center justify-between rounded-[24px] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
            <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
              {liveFriendLocations.length > 0 ? `${liveFriendLocations.length} friends nearby` : 'Campus is active'}
            </span>
          </div>
          <Users className="h-4 w-4 text-sky-500" />
        </section>
      </aside>

      <div
        className={`absolute inset-x-0 bottom-32 z-[999] px-4 transition-all duration-500 sm:px-6 xl:hidden ${
          (buzzVisible && !pulseSheetOpen && !plannerOpen && !checkinSheetOpen && !whosAroundOpen && !selectedPulseForJoin) 
            ? 'opacity-100 translate-y-0' 
            : 'pointer-events-none opacity-0 translate-y-4'
        }`}
        data-testid="campus-buzzing-card"
      >
        <div className="campus-glass-card mx-auto max-w-md rounded-[28px] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">Campus is buzzing</p>
              <p className="mt-1 text-xs text-slate-500">
                {liveFriendLocations.length} friends nearby, {nearbyEvents.length} events today
              </p>
            </div>
            <button
              type="button"
              onClick={() => setWhosAroundOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-200"
              data-testid="whos-around-trigger"
            >
              <Users className="h-3.5 w-3.5" />
              Who's around
            </button>
          </div>
        </div>
      </div>

      {/* FEATURES 1 + 5 — Floating action stack (bottom-right) */}
      <div className={`absolute bottom-36 right-4 z-[1000] flex flex-col items-end gap-3 xl:bottom-8 transition-all duration-300 ${whosAroundOpen || plannerOpen || checkinSheetOpen || pulseSheetOpen || selectedPulseForJoin ? 'opacity-0 translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
        <button
          type="button"
          onClick={(e) => { e.currentTarget.blur(); setWhosAroundOpen(true); }}
          className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/85 px-4 py-2.5 text-sm font-bold text-sky-700 shadow-[0_18px_40px_rgba(14,165,233,0.18)] backdrop-blur-xl transition hover:scale-[0.98]"
          data-testid="whos-around-fab"
        >
          <Users className="h-4 w-4" />
          Who's around
        </button>
        <button
          type="button"
          onClick={(e) => { e.currentTarget.blur(); setPlannerOpen(true); }}
          className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/85 px-4 py-2.5 text-sm font-bold text-sky-700 shadow-[0_18px_40px_rgba(14,165,233,0.25)] backdrop-blur-xl transition hover:scale-[0.98]"
        >
          <span className="text-sm">🎪</span>
          Plan Hangout
        </button>
        <button
          type="button"
          onClick={(e) => { e.currentTarget.blur(); setCheckinSheetOpen(true); }}
          className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/85 px-4 py-2.5 text-sm font-bold text-sky-700 shadow-[0_18px_40px_rgba(14,165,233,0.25)] backdrop-blur-xl transition hover:scale-[0.98]"
          data-testid="checkin-fab"
        >
          <LocateFixed className="h-4 w-4" />
          Check In
        </button>
        <button
          type="button"
          onClick={(e) => { e.currentTarget.blur(); setPulseSheetOpen(true); }}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-sky-500 to-cyan-500 px-5 py-3 text-sm font-extrabold text-white shadow-[0_24px_50px_rgba(14,165,233,0.45)] transition hover:scale-[0.97]"
          data-testid="pulse-fab"
        >
          <Plus className="h-4 w-4" />
          Pulse
        </button>
      </div>

      {/* Sheets */}
      <PulseSheet open={pulseSheetOpen} onOpenChange={setPulseSheetOpen} />
      <HangoutPlanner open={plannerOpen} onOpenChange={setPlannerOpen} />
      <CheckInSheet open={checkinSheetOpen} onOpenChange={setCheckinSheetOpen} />
      <WhosAroundPanel open={whosAroundOpen} onOpenChange={setWhosAroundOpen} />

      {/* Ad Details Modal */}
      {selectedAd && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-sm rounded-[32px] bg-white overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8 duration-500">
            <div className="relative h-48 w-full bg-slate-100">
              <img 
                src={selectedAd.imageUrl || (selectedAd as any).bannerUrl || ''} 
                className="h-full w-full object-cover" 
                alt={selectedAd.brandName}
              />
              <button 
                onClick={() => setSelectedAd(null)}
                className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/20 text-white backdrop-blur-md flex items-center justify-center hover:bg-white/40 transition-colors shadow-lg"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="absolute bottom-4 left-6">
                <span className="rounded-full bg-orange-500 px-3 py-1 text-[10px] font-bold text-white uppercase tracking-wider shadow-lg">Featured Ad</span>
              </div>
            </div>
            <div className="p-6 pt-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold text-slate-900">{selectedAd.brandName}</h3>
                <span className="text-[10px] font-black bg-slate-100 text-slate-400 px-2 py-0.5 rounded-md uppercase tracking-widest">Sponsored</span>
              </div>
              <p className="text-sky-600 font-bold text-sm mb-4 italic">{selectedAd.title}</p>
              
              <div className="space-y-4">
                <p className="text-slate-500 text-sm leading-relaxed font-medium">
                  {selectedAd.description || 'Visit us on campus for special student offers and unique experiences.'}
                </p>
                <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold">
                  <MapPin className="h-3.5 w-3.5 text-sky-400" />
                  <span>{selectedAd.location.name || 'Campus Location'}</span>
                </div>
              </div>
              
              <div className="mt-8 flex gap-3">
                <button 
                  onClick={() => setSelectedAd(null)}
                  className="flex-1 h-12 rounded-2xl bg-slate-50 text-slate-500 text-sm font-bold transition hover:bg-slate-100"
                >
                  Close
                </button>
                {selectedAd.ctaLink && (
                  <button 
                    onClick={() => {
                      window.open(selectedAd.ctaLink, '_blank');
                      if (selectedAd.id) recordAdClick(selectedAd.id);
                    }}
                    className="flex-[2] h-12 rounded-2xl bg-sky-600 text-white text-sm font-bold shadow-lg shadow-sky-100 transition hover:bg-sky-700 active:scale-95"
                  >
                    Learn More
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function MapViewport({
  center,
  markers,
}: {
  center: { lat: number; lng: number };
  markers: Array<{ lat: number; lng: number }>;
}) {
  const map = useMap();
  const hasInitialized = React.useRef(false);

  useEffect(() => {
    // Only set the view on the FIRST load — don't snap back on re-renders
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Center on the user's current location initially
    map.setView([center.lat, center.lng], 16, { animate: true });
  }, [center.lat, center.lng, map]);

  return null;
}

function createAvatarIcon(image: string, accent: string) {
  const ringColor =
    accent.includes('cyan') ? 'rgba(34, 211, 238, 0.7)' :
    accent.includes('300') ? 'rgba(125, 211, 252, 0.8)' :
    'rgba(56, 189, 248, 0.8)';

  return L.divIcon({
    className: 'campus-map-marker',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-10px);">
        <div style="width:48px;height:48px;border-radius:9999px;overflow:hidden;border:2px solid white;box-shadow:0 16px 40px rgba(0,84,127,0.18);box-shadow:0 0 0 2px ${ringColor};background:white;">
          <img src="${image}" alt="" style="width:100%;height:100%;object-fit:cover;" />
        </div>
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
}

function createCheckinIcon(location: string) {
  const initial = (location || '•').charAt(0).toUpperCase();
  return L.divIcon({
    className: 'campus-checkin-marker',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-6px);">
        <div style="display:flex;align-items:center;gap:4px;padding:4px 10px;border-radius:9999px;background:white;border:1px solid rgba(125,211,252,0.7);box-shadow:0 10px 24px rgba(14,165,233,0.25);">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:9999px;background:#0ea5e9;color:white;font-size:10px;font-weight:700;">${initial}</span>
          <span style="font-size:10px;font-weight:700;color:#0369a1;white-space:nowrap;">${location}</span>
        </div>
      </div>
    `,
    iconSize: [120, 28],
    iconAnchor: [60, 14],
  });
}

function createMyAvatarIcon(image: string, vibeEmoji?: string) {
  // Current user's location marker — their photo with a bright sky ring + pulse halo
  const safeUrl = image.replace(/"/g, '&quot;');
  const badge = vibeEmoji
    ? `<div style="position:absolute;right:-4px;bottom:-4px;width:22px;height:22px;border-radius:9999px;background:white;border:2px solid #0ea5e9;display:flex;align-items:center;justify-content:center;font-size:12px;line-height:1;box-shadow:0 4px 10px rgba(14,165,233,0.25);">${vibeEmoji}</div>`
    : '';
  return L.divIcon({
    className: 'campus-me-marker',
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translateY(-10px);">
        <div style="position:absolute;inset:-6px;border-radius:9999px;background:rgba(56,189,248,0.35);animation:campusMePulse 2s ease-out infinite;"></div>
        <div style="position:relative;width:52px;height:52px;border-radius:9999px;overflow:visible;">
          <div style="width:52px;height:52px;border-radius:9999px;overflow:hidden;border:3px solid white;box-shadow:0 0 0 3px #0ea5e9,0 18px 40px rgba(0,84,127,0.22);background:white;">
            <img src="${safeUrl}" alt="" style="width:100%;height:100%;object-fit:cover;" />
          </div>
          ${badge}
        </div>
      </div>
    `,
    iconSize: [52, 52],
    iconAnchor: [26, 26],
  });
}

function createMyInitialIcon(initial: string, vibeEmoji?: string) {
  // Fallback when user has no photo uploaded yet
  const badge = vibeEmoji
    ? `<div style="position:absolute;right:-4px;bottom:-4px;width:22px;height:22px;border-radius:9999px;background:white;border:2px solid #0ea5e9;display:flex;align-items:center;justify-content:center;font-size:12px;line-height:1;box-shadow:0 4px 10px rgba(14,165,233,0.25);">${vibeEmoji}</div>`
    : '';
  return L.divIcon({
    className: 'campus-me-marker',
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translateY(-10px);">
        <div style="position:absolute;inset:-6px;border-radius:9999px;background:rgba(56,189,248,0.35);animation:campusMePulse 2s ease-out infinite;"></div>
        <div style="position:relative;width:52px;height:52px;">
          <div style="display:flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:9999px;border:3px solid white;box-shadow:0 0 0 3px #0ea5e9,0 18px 40px rgba(0,84,127,0.22);background:linear-gradient(135deg,#0ea5e9,#7dd3fc);color:white;font-weight:800;font-size:18px;font-family:'Plus Jakarta Sans',sans-serif;">
            ${initial}
          </div>
          ${badge}
        </div>
      </div>
    `,
    iconSize: [52, 52],
    iconAnchor: [26, 26],
  });
}

function createAdIcon(brandName: string, imageUrl: string, bannerText?: string) {
  const safeUrl = (imageUrl || '').replace(/"/g, '&quot;');
  const safeBrand = (brandName || 'Ad').replace(/"/g, '&quot;');
  const safeBanner = (bannerText || '').replace(/"/g, '&quot;');
  const hasBanner = !!bannerText;
  
  // Use a fallback background color and ensure the image fills the space correctly
  return L.divIcon({
    className: 'campus-ad-marker',
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translateY(-${hasBanner ? 42 : 8}px);">
        ${hasBanner ? `
        <div style="
          position:relative;margin-bottom:6px;
          background:linear-gradient(135deg,#f59e0b,#ef4444);
          color:white;font-size:10px;font-weight:900;
          padding:4px 10px;border-radius:20px;
          white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis;
          box-shadow:0 4px 15px rgba(245,158,11,0.4);
          animation:campusMePulse 2.5s ease-out infinite;
          letter-spacing:0.02em;
        ">
          🔥 ${safeBanner}
          <div style="position:absolute;bottom:-5px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:6px solid #ef4444;"></div>
        </div>` : ''}
        <div style="position:absolute;inset:${hasBanner ? '34px' : '-4px'} -4px -4px -4px;border-radius:14px;background:rgba(245,158,11,0.18);animation:campusMePulse 2s ease-out infinite;"></div>
        <div style="position:relative;width:48px;height:48px;border-radius:14px;background:#fff7ed;border:2.5px solid #f59e0b;box-shadow:0 8px 24px rgba(245,158,11,0.35);overflow:hidden;display:flex;align-items:center;justify-content:center;">
          ${safeUrl ? `<img src="${safeUrl}" alt="${safeBrand}" style="width:100%;height:100%;object-fit:cover;" />` : `<span style="font-size:20px;">🏢</span>`}
          <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to right,#f59e0b,#ef4444);color:white;font-size:7px;font-weight:900;text-align:center;padding:2px 0;text-transform:uppercase;letter-spacing:0.08em;z-index:10;">AD</div>
        </div>
        <div style="margin-top:3px;background:white;border-radius:8px;padding:1px 6px;font-size:8px;font-weight:700;color:#92400e;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:90px;overflow:hidden;text-overflow:ellipsis;">
          ${safeBrand}
        </div>
      </div>
    `,
    iconSize: [hasBanner ? 180 : 52, hasBanner ? 100 : 60],
    iconAnchor: [hasBanner ? 90 : 26, hasBanner ? 100 : 52],
  });
}
