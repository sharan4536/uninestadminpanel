import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useUniversity } from '../../../hooks/useUniversity';
import {
  ArrowLeft,
  Camera,
  Clock3,
  Edit3,
  Globe2,
  LogOut,
  Lock,
  MapPin,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Switch } from '../../../components/ui/switch';
import { auth, isFirebaseConfigured, storage } from '../../../utils/firebase/client';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { onAuthStateChanged, updateProfile as updateAuthProfile, deleteUser } from 'firebase/auth';
import { updateUserProfile, updateProfile, getProfile, getUserStatus, getFriends, UserProfile, loadTimetable, getCurrentLocation, type ClassItem } from '../../../utils/firebase/firestore';
import { PrivacySettingsPage } from './PrivacySettingsPage';
import { ImageCropper } from './ImageCropper';
import { FindFreeTimeButton } from '../../timetable/components/FreeTimeFinder';
import { WEEKDAYS, getTodayKey, type DayKey } from '../../../utils/scheduleCompare';
import { toast } from 'sonner';
import { getMapLocationName } from '../../../utils/mapUtils';

// Spots are now derived per-university from checkinPresets — see useUniversity() inside the component.

type CurrentUser = {
  id?: string;
  name?: string;
  email?: string;
  university?: string;
  year?: string;
  major?: string;
  bio?: string;
  interests?: string[];
  location?: { name?: string } | null;
  isAdmin?: boolean;
  isDevelopmentUser?: boolean;
} | null | undefined;

type ProfileData = {
  name: string;
  email: string;
  university: string;
  year: string;
  major: string;
  bio: string;
  interests: string[];
  location: string;
  photoURL?: string;
};

type TabKey = 'clubs' | 'schedule' | 'friends';

const tabLabels: Array<{ id: TabKey; label: string }> = [
  { id: 'schedule', label: 'Schedule' },
  { id: 'clubs', label: 'Clubs' },
  { id: 'friends', label: 'Friends' },
];

export function ProfilePage({
  currentUser,
  onProfileUpdate,
  onLogout,
  onNavigate,
}: {
  currentUser?: CurrentUser;
  onProfileUpdate?: (updatedUser: CurrentUser) => void;
  onLogout?: () => void;
  onNavigate?: (page: string) => void;
}) {
  const university = useUniversity();
  // Derive spots from the current university's check-in presets
  const MANUAL_SPOTS = useMemo(
    () => university.checkinPresets.map((p) => p.label),
    [university],
  );

  const [isEditing, setIsEditing] = useState(false);
  const editSectionRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing) {
      setTimeout(() => {
        editSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  }, [isEditing]);

  const [activeTab, setActiveTab] = useState<TabKey>('schedule');
  const [currentStatus, setCurrentStatus] = useState<'in class' | 'in library' | 'in ground' | 'in hostel' | 'available'>('available');
  const [profileData, setProfileData] = useState<ProfileData>({
    name: currentUser?.name || '',
    email: currentUser?.email || '',
    university: currentUser?.university || '',
    year: currentUser?.year || '',
    major: currentUser?.major || '',
    bio: '',
    interests: [],
    location: currentUser?.location?.name || '',
    photoURL: undefined,
  });
  const [majorOther, setMajorOther] = useState('');
  const [saving, setSaving] = useState(false);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);
  const [timetable, setTimetable] = useState<Record<string, ClassItem[]>>({});
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [privacySettings, setPrivacySettings] = useState({
    ghostMode: (() => {
      try {
        return localStorage.getItem('ghostMode') === 'on';
      } catch {
        return false;
      }
    })(),
    locationVisible: true,
    onlineStatusVisible: true,
    discoverVisible: true,
    timetableVisible: true,
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null); // null = checking
  const [autoSpot, setAutoSpot] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (privacySettings.ghostMode) {
        localStorage.setItem('ghostMode', 'on');
      } else {
        localStorage.removeItem('ghostMode');
      }
    } catch { }
  }, [privacySettings.ghostMode]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, () => { });

    const loadProfile = async () => {
      // Prevent resetting the user's typed input if they are currently editing
      if (isEditing) return;

      let loadedFromSaved = false;

      if (isFirebaseConfigured && auth.currentUser) {
        try {
          const userProfile = await getProfile(auth.currentUser.uid);
          if (userProfile) {
            setProfileData({
              name: userProfile.name || '',
              email: userProfile.email || auth.currentUser.email || '',
              university: userProfile.university || '',
              year: userProfile.year || '',
              major: userProfile.major || '',
              bio: userProfile.bio || '',
              interests: userProfile.interests || [],
              location: userProfile.location?.name || '',
              photoURL: (userProfile as any).photoURL || undefined,
            });
            loadedFromSaved = true;
            if ((userProfile as any).privacySettings) {
              setPrivacySettings((userProfile as any).privacySettings);
            }
          }
        } catch (error) {
          console.error('Error loading profile from Firebase:', error);
        }
      }

      if (currentUser && !loadedFromSaved) {
        setProfileData((prev) => ({
          ...prev,
          name: currentUser.name || prev.name,
          email: currentUser.email || auth.currentUser?.email || prev.email,
          university: currentUser.university || prev.university,
          year: currentUser.year || prev.year,
          major: currentUser.major || prev.major,
          location: currentUser.location?.name || prev.location,
        }));
      }
    };

    loadProfile();
    return () => unsubscribe();
  }, [currentUser, isEditing]);

  useEffect(() => {
    const loadUserStatus = async () => {
      if (isFirebaseConfigured && auth.currentUser) {
        try {
          const status = await getUserStatus();
          if (status) {
            setCurrentStatus(status as 'in class' | 'in library' | 'in ground' | 'in hostel' | 'available');
          }
        } catch (error) {
          console.error('Error loading user status:', error);
        }
      }
    };

    loadUserStatus();
  }, []);

  useEffect(() => {
    const loadUserTimetable = async () => {
      if (!(isFirebaseConfigured && auth.currentUser)) {
        setTimetable({});
        return;
      }

      try {
        setTimetableLoading(true);
        const data = await loadTimetable();
        setTimetable(data || {});
      } catch (error) {
        console.error('Error loading user timetable for profile:', error);
        setTimetable({});
      } finally {
        setTimetableLoading(false);
      }
    };

    loadUserTimetable();
  }, []);

  useEffect(() => {
    setFriendsLoading(true);
    const unsubscribe = getFriends((list) => {
      setFriends(list);
      setFriendsLoading(false);
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  // Auto-detect nearest landmark when location is available
  useEffect(() => {
    let cancelled = false;

    const detectSpot = async () => {
      try {
        const pos = await getCurrentLocation();
        if (cancelled) return;

        // Fetch real location name from map API instead of just nearest landmark
        const locationName = await getMapLocationName(pos.lat, pos.lng);
        if (cancelled) return;

        setAutoSpot(locationName);
        setLocationGranted(true);
        // Update profile data with the detected spot
        setProfileData((prev) => ({ ...prev, location: locationName }));
      } catch {
        if (cancelled) return;
        setLocationGranted(false);
        setAutoSpot(null);
      }
    };

    detectSpot();
    // Re-check every 60 seconds
    const interval = setInterval(detectSpot, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const runFirestoreRuleDiagnostics = async () => {
    const user = auth.currentUser;
    if (!user) return;

    // Refresh user state to get latest verification status
    try {
      await user.reload();
    } catch (e) {
      console.error('Failed to reload user for diagnostics:', e);
    }

    const diagnostics = {
      isSignedIn: !!user,
      emailVerified: user.emailVerified,
      isVITEmail: user.email?.endsWith('@vitstudent.ac.in') || false,
    };

    console.log('FIRESTORE RULE DIAGNOSTICS:', diagnostics);
    return diagnostics;
  };

  const handleSave = async (): Promise<void> => {
    const diag = await runFirestoreRuleDiagnostics();

    try {
      setSaving(true);

      const committedMajor = profileData.major === 'OTHER' && majorOther.trim() ? majorOther.trim() : profileData.major;
      const payload: ProfileData = {
        ...profileData,
        major: committedMajor,
      };

      const isFirebaseUser = isFirebaseConfigured && auth.currentUser;
      const isDevelopmentUser = import.meta.env.DEV && currentUser?.isDevelopmentUser;

      if (isFirebaseUser) {
        // Use the fresh status from diagnostics
        if (!diag?.emailVerified) {
          alert('Please verify your email address before saving your profile.');
          return;
        }

        const updateData = {
          name: payload.name,
          email: payload.email,
          // university & universityId are locked at registration — never mutated here
          year: payload.year,
          major: payload.major,
          bio: payload.bio,
          interests: payload.interests,
          photoURL: payload.photoURL || null,
          privacySettings,
        };

        await updateProfile(auth.currentUser.uid, updateData);
        await updateAuthProfile(auth.currentUser, { displayName: updateData.name });
        await updateUserProfile(auth.currentUser.uid, {
          photoURL: updateData.photoURL || undefined,
          displayName: updateData.name,
          name: updateData.name,
          privacySettings: privacySettings
        });
      } else if (isDevelopmentUser) {
        const userProfileForStorage = {
          id: currentUser?.id || 'dev-user-123',
          name: payload.name,
          email: payload.email,
          university: payload.university,
          year: payload.year,
          major: payload.major,
          bio: payload.bio,
          interests: payload.interests,
          location: { name: payload.location },
          photoURL: payload.photoURL,
          isDevelopmentUser: true,
        };

        localStorage.setItem('userProfile', JSON.stringify(userProfileForStorage));
        if (onProfileUpdate) {
          onProfileUpdate(userProfileForStorage);
        }
      } else {
        alert('Cannot save profile: user not authenticated and not in development mode.');
        return;
      }

      setProfileData(payload);
      setIsEditing(false);
    } catch (e) {
      console.error('Failed to save profile:', e);
      alert(`Failed to save profile: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!auth.currentUser) return;
    const confirmed = window.confirm(
      "Are you sure you want to delete your account? This action cannot be undone."
    );
    if (!confirmed) return;

    try {
      await deleteUser(auth.currentUser);
      toast.success('Account deleted successfully.');
      if (onLogout) onLogout();
    } catch (error: any) {
      console.error('Error deleting account:', error);
      if (error.code === 'auth/requires-recent-login') {
        toast.error('Please log out and log back in to delete your account.');
      } else {
        toast.error('Failed to delete account. Please try again.');
      }
    }
  };

  const handlePrivacyChange = (field: keyof typeof privacySettings, value: boolean) => {
    setPrivacySettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleInputChange = (field: keyof ProfileData, value: string | string[]) => {
    setProfileData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleInterestChange = (index: number, value: string) => {
    setProfileData((prev) => ({
      ...prev,
      interests: prev.interests.map((item, itemIndex) => (itemIndex === index ? value : item)),
    }));
  };

  const handleAddInterest = () => {
    setProfileData((prev) => ({
      ...prev,
      interests: [...prev.interests, 'New Interest'],
    }));
  };

  const handleRemoveInterest = (index: number) => {
    setProfileData((prev) => ({
      ...prev,
      interests: prev.interests.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleRemovePhoto = async () => {
    const oldUrl = profileData.photoURL;
    if (!oldUrl) return;

    try {
      setPhotoUploading(true);
      if (isFirebaseConfigured && auth.currentUser && storage && oldUrl.includes('firebasestorage')) {
        try {
          const oldRef = ref(storage, oldUrl);
          await deleteObject(oldRef);
        } catch (e) {
          console.warn('Failed to delete old photo:', e);
        }
      }

      setProfileData((prev) => ({ ...prev, photoURL: undefined }));

      if (isFirebaseConfigured && auth.currentUser) {
        Promise.all([
          updateAuthProfile(auth.currentUser, { photoURL: '' }),
          updateProfile(auth.currentUser.uid, { photoURL: null }),
          updateUserProfile(auth.currentUser.uid, { photoURL: undefined })
        ]).catch(console.error);
      } else {
        try {
          const raw = localStorage.getItem('userProfile');
          const parsed = raw ? JSON.parse(raw) : {};
          localStorage.setItem('userProfile', JSON.stringify({ ...parsed, photoURL: null }));
        } catch { }
      }

      if (onProfileUpdate) {
        onProfileUpdate({ ...(currentUser as any), photoURL: null });
      }

      toast.success("Profile photo removed");
    } catch (err: any) {
      console.error('Failed to remove photo:', err);
      setPhotoError('Failed to remove photo');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handlePickPhoto = () => {
    setPhotoError(null);
    fileInputRef.current?.click();
  };

  const handlePhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError(null);

    // Read into a data URL and open the cropper
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setCropSrc(dataUrl);
      setCropOpen(true);
    };
    reader.readAsDataURL(file);

    // Reset input so selecting the same file again re-triggers onChange
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropCancel = () => {
    setCropOpen(false);
    setCropSrc(null);
  };

  const handleCropDone = async (blob: Blob) => {
    setCropOpen(false);
    setCropSrc(null);

    try {
      setPhotoUploading(true);

      let finalUrl = '';

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onloadend = () => resolve(fr.result as string);
        fr.onerror = () => reject(new Error('Failed to read cropped image'));
        fr.readAsDataURL(blob);
      });

      if (isFirebaseConfigured && auth.currentUser && storage) {
        try {
          // Attempt to delete old photo
          const oldUrl = profileData.photoURL;
          if (oldUrl && oldUrl.includes('firebasestorage')) {
            try {
              const oldRef = ref(storage, oldUrl);
              await deleteObject(oldRef);
            } catch (e) {
              console.warn('Failed to delete old photo during change:', e);
            }
          }

          const path = `profile_photos/${auth.currentUser.uid}/${Date.now()}_avatar.jpg`;
          const storageRef = ref(storage, path);
          await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
          finalUrl = await getDownloadURL(storageRef);
        } catch (storageError) {
          console.warn('Firebase Storage failed, falling back to base64 Data URL', storageError);
          finalUrl = dataUrl;
        }
      } else {
        finalUrl = dataUrl;
      }

      setProfileData((prev) => ({ ...prev, photoURL: finalUrl }));

      // Stop the loader early so the user can keep using the app
      setPhotoUploading(false);

      if (isFirebaseConfigured && auth.currentUser) {
        // Run database updates concurrently in the background
        Promise.all([
          updateAuthProfile(auth.currentUser, { photoURL: finalUrl }),
          updateProfile(auth.currentUser.uid, { photoURL: finalUrl }),
          updateUserProfile(auth.currentUser.uid, { photoURL: finalUrl })
        ]).catch(console.error);
      } else {
        try {
          const raw = localStorage.getItem('userProfile');
          const parsed = raw ? JSON.parse(raw) : {};
          localStorage.setItem('userProfile', JSON.stringify({ ...parsed, photoURL: finalUrl }));
        } catch { }
      }

      if (onProfileUpdate) {
        onProfileUpdate({ ...(currentUser as any), photoURL: finalUrl });
      }
    } catch (err: any) {
      console.error('Photo upload failed:', err);
      setPhotoError(err?.message || 'Failed to upload image');
    } finally {
      setPhotoUploading(false);
    }
  };

  let displayName = profileData.name || currentUser?.name || 'New Student';
  if (displayName.includes('@')) {
    displayName = displayName.split('@')[0];
  }
  const displayYearStr = profileData.year && profileData.year.match(/^\d{4}$/) ? `Class of ${profileData.year}` : profileData.year;
  const displaySubtitle = [profileData.major, displayYearStr].filter(Boolean).join(' • ') || 'Campus Explorer';
  const friendCount = friends.length;

  const clubList = useMemo(
    () => profileData.interests.slice(0, 3).map((interest) => `${interest} Club`),
    [profileData.interests]
  );

  const scheduleItems = useMemo(() => {
    return Object.entries(timetable)
      .flatMap(([day, classes]) =>
        (classes || []).map((item) => ({
          key: `${day}-${item.id}-${item.time}`,
          day,
          title: item.title || item.course || 'Class',
          place: item.location || item.academicBlock || 'Location TBA',
          time: item.time,
        }))
      )
      .sort((a, b) => a.day.localeCompare(b.day) || a.time.localeCompare(b.time));
  }, [timetable]);

  // Group schedule items by weekday key (MON-FRI) for the Schedule tab.
  // Sort each day's classes by start time (minutes since midnight).
  const scheduleByDay = useMemo(() => {
    const parseStart = (t: string): number => {
      if (!t) return 24 * 60;
      const [maybeTime] = t.split('-').map((s) => s.trim());
      const m12 = maybeTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (m12) {
        let hh = parseInt(m12[1], 10);
        const mm = parseInt(m12[2], 10);
        const ap = m12[3].toUpperCase();
        if (ap === 'AM' && hh === 12) hh = 0;
        if (ap === 'PM' && hh !== 12) hh += 12;
        return hh * 60 + mm;
      }
      const m24 = maybeTime.match(/^(\d{1,2}):(\d{2})$/);
      if (m24) return parseInt(m24[1], 10) * 60 + parseInt(m24[2], 10);
      return 24 * 60;
    };

    const grouped = {} as Record<DayKey, typeof scheduleItems>;
    for (const day of WEEKDAYS) grouped[day] = [];
    for (const item of scheduleItems) {
      const key = (item.day || '').slice(0, 3).toUpperCase() as DayKey;
      if (grouped[key]) grouped[key].push(item);
    }
    for (const day of WEEKDAYS) {
      grouped[day] = [...grouped[day]].sort((a, b) => parseStart(a.time) - parseStart(b.time));
    }
    return grouped;
  }, [scheduleItems]);

  const dayFullLabel: Record<DayKey, string> = {
    MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday',
  };
  const todayKey = getTodayKey();

  if (showPrivacySettings) {
    return (
      <div className="absolute inset-0 z-50 overflow-y-auto bg-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <button
          onClick={() => setShowPrivacySettings(false)}
          className="fixed left-4 top-[calc(1rem+env(safe-area-inset-top))] z-50 rounded-full p-2 hover:bg-gray-100"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <PrivacySettingsPage />
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-sky-50 text-slate-800 pb-[calc(5rem+env(safe-area-inset-bottom))]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Ambient sky/violet blurs (matches Discover) */}
      <div aria-hidden className="pointer-events-none absolute -top-48 left-[55%] w-48 h-48 bg-sky-400/10 rounded-full blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute top-[900px] -left-10 w-48 h-48 bg-violet-500/5 rounded-full blur-3xl" />

      {/* Sticky glass header (matches Discover) */}
      <header className="sticky top-0 z-30 flex w-full items-center justify-between border-b border-sky-400/10 bg-white/60 px-5 py-3 backdrop-blur-md">
        <button
          type="button"
          onClick={() => setIsEditing((prev) => !prev)}
          className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white ring-2 ring-sky-400/20"
          aria-label="Edit profile"
          data-testid="profile-header-avatar-btn"
        >
          {profileData.photoURL ? (
            <img src={profileData.photoURL} alt={displayName} className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-sky-700">{displayName.charAt(0)}</span>
          )}
        </button>

        <div className="text-lg font-bold tracking-tight text-sky-400" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Profile
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPrivacySettings(true)}
            className="rounded-full p-2 text-sky-500 transition-colors hover:bg-sky-100/60"
            aria-label="Privacy settings"
            data-testid="profile-privacy-btn"
          >
            <Lock className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main content - normal flow, fills viewport, scrolls naturally */}
      <section className="relative mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
        <div className="rounded-[2rem] bg-white/70 px-5 py-6 shadow-[0_10px_40px_rgba(56,189,248,0.08)] ring-1 ring-sky-400/10 backdrop-blur-[12px] sm:px-7 sm:py-8">
          <header className="flex flex-col items-center text-center">
            <div className="group relative">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-sky-400 to-sky-200 opacity-30 blur-sm transition-opacity group-hover:opacity-50" />
              <Avatar className="relative h-24 w-24 border-4 border-white shadow-xl">
                <AvatarImage src={profileData.photoURL} alt={displayName} className="object-cover" />
                <AvatarFallback className="bg-sky-100 text-2xl font-bold text-sky-700">
                  {displayName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={handlePickPhoto}
                className="absolute bottom-0.5 right-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-sky-400 text-white shadow-[0_4px_6px_-4px_rgba(56,189,248,0.3),0_10px_15px_-3px_rgba(56,189,248,0.3)] transition-transform active:scale-95 hover:bg-sky-500"
                aria-label="Upload photo"
                data-testid="profile-upload-photo-btn"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoSelected}
            />

            <div className="mt-3">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {displayName}
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-500">{displaySubtitle}</p>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
              <span className="rounded-full bg-sky-400/10 px-3 py-1 text-sky-600 ring-1 ring-sky-400/20">{friendCount} friends</span>
              <span className="rounded-full bg-white px-3 py-1 text-slate-600 ring-1 ring-sky-400/10">
                {friendsLoading ? 'Syncing network...' : profileData.location || 'On campus'}
              </span>
            </div>

            <div className="mt-5 w-full max-w-xs">
              <Button
                type="button"
                onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
                disabled={saving}
                className="h-11 w-full rounded-2xl bg-sky-400 text-sm font-bold text-white shadow-[0_10px_15px_-3px_rgba(56,189,248,0.3),0_4px_6px_-4px_rgba(56,189,248,0.3)] hover:bg-sky-500"
                data-testid="profile-edit-save-btn"
              >
                {isEditing ? <Save className="mr-2 h-4 w-4" /> : <Edit3 className="mr-2 h-4 w-4" />}
                {saving ? 'Saving...' : isEditing ? 'Save Profile' : 'Edit Profile'}
              </Button>
            </div>

            {(photoUploading || photoError) && (
              <div className="mt-2 text-xs text-slate-500">
                {photoUploading ? 'Uploading photo...' : photoError}
              </div>
            )}
          </header>

          <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
            <InfoChip icon={Globe2} label="Campus" value={profileData.university || 'UniNest'} />
            <div className="rounded-[1.5rem] border border-slate-200/70 bg-white/70 p-4 shadow-[0_10px_30px_rgba(148,163,184,0.08)]">
              <div className="flex items-center gap-2 text-sky-600">
                <MapPin className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-[0.18em]">Spot</span>
                {locationGranted && autoSpot && (
                  <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    GPS
                  </span>
                )}
              </div>
              {locationGranted === false ? (
                <select
                  value={profileData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  className="mt-2 w-full rounded-xl border border-sky-400/20 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-sky-400 cursor-pointer"
                >
                  {!MANUAL_SPOTS.includes(profileData.location) && (
                    <option value={profileData.location}>{profileData.location}</option>
                  )}
                  {MANUAL_SPOTS.map((spot) => (
                    <option key={spot} value={spot}>{spot}</option>
                  ))}
                </select>
              ) : (
                <p className="mt-2 text-sm font-semibold text-slate-800">
                  {autoSpot || profileData.location || 'Detecting...'}
                </p>
              )}
            </div>
          </div>

          <nav className="mt-6">
            <div className="flex items-center justify-between rounded-2xl bg-white/60 p-1 ring-1 ring-sky-400/10">
              {tabLabels.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 rounded-xl px-2 py-2 text-sm font-semibold transition-colors ${activeTab === tab.id
                      ? 'bg-sky-400 text-white shadow-[0_4px_6px_-4px_rgba(56,189,248,0.3)]'
                      : 'text-slate-600 hover:bg-sky-50'
                    }`}
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  data-testid={`profile-tab-${tab.id}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </nav>

          <section className="mt-6">
            {activeTab === 'schedule' && (
              <div className="space-y-4">
                <FindFreeTimeButton />

                {timetableLoading ? (
                  <p className="text-sm text-slate-500">Loading your timetable...</p>
                ) : scheduleItems.length === 0 ? (
                  <div className="rounded-[1.25rem] bg-white/60 ring-1 ring-sky-400/10 p-4 text-center">
                    <p className="text-sm font-semibold text-slate-800">No timetable in database yet</p>
                    <p className="mt-1 text-xs text-slate-500">Upload or create your timetable to see it here.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {WEEKDAYS.map((day) => {
                      const items = scheduleByDay[day];
                      const isToday = todayKey === day;
                      return (
                        <div
                          key={day}
                          data-testid={`profile-schedule-day-${day}`}
                          className={`rounded-[1.25rem] p-4 ring-1 transition ${isToday
                              ? 'bg-white ring-sky-400/40 shadow-[0_4px_6px_-4px_rgba(56,189,248,0.2)]'
                              : 'bg-white/60 ring-sky-400/10'
                            }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h3
                              className={`text-sm font-extrabold tracking-tight ${isToday ? 'text-sky-600' : 'text-slate-800'}`}
                              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                            >
                              {dayFullLabel[day]}
                              {isToday && (
                                <span className="ml-2 text-[9px] font-bold uppercase tracking-widest text-sky-500 align-middle">Today</span>
                              )}
                            </h3>
                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              {items.length} {items.length === 1 ? 'class' : 'classes'}
                            </span>
                          </div>
                          {items.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">Nothing scheduled.</p>
                          ) : (
                            <div className="space-y-3">
                              {items.map((item) => (
                                <div key={item.key} className="relative flex gap-3">
                                  <div className="mt-1 h-4 w-4 shrink-0 rounded-full border-[3px] border-white bg-sky-400 shadow-sm" />
                                  <div className="flex-1">
                                    <h4 className="text-sm font-bold text-slate-800 leading-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                                      {item.title}
                                    </h4>
                                    <p className="text-xs text-slate-500 mt-0.5">{item.place}</p>
                                    <div className="mt-1 flex items-center gap-1.5 text-slate-500">
                                      <Clock3 className="h-3 w-3" />
                                      <span className="text-[11px] font-medium">{item.time}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'clubs' && (
              <div className="space-y-3">
                <p className="text-sm leading-relaxed text-slate-600">
                  {profileData.bio || 'Add a short intro so people can know you better.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {profileData.interests.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No clubs added yet.</p>
                  ) : (
                    profileData.interests.map((interest, index) => (
                      <span
                        key={`${interest}-${index}`}
                        className="rounded-full bg-sky-400/10 px-3 py-1.5 text-sm font-medium text-sky-600 ring-1 ring-sky-400/20"
                      >
                        {interest}
                      </span>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'friends' && (
              <div className="space-y-3">
                {friendsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <p className="text-sm text-slate-500 animate-pulse">Syncing network...</p>
                  </div>
                ) : friends.length === 0 ? (
                  <div className="rounded-[1.25rem] bg-white/60 ring-1 ring-sky-400/10 p-5 text-center">
                    <p className="text-sm font-semibold text-slate-800">No friends yet</p>
                    <p className="mt-1.5 text-xs text-slate-500">Connect with other students in the Discover tab to build your network.</p>
                  </div>
                ) : (
                  <div className="grid gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                    {friends.map((friend) => {
                      const name = friend.displayName || (friend as any).name || 'User';
                      const subtitle = [friend.major, friend.year ? `Class of ${friend.year}` : ''].filter(Boolean).join(' • ');
                      return (
                        <div
                          key={friend.uid}
                          className="flex items-center gap-3.5 rounded-[1.25rem] bg-white/60 ring-1 ring-sky-400/10 p-3.5 shadow-sm transition hover:bg-white"
                        >
                          <Avatar className="h-10 w-10 border border-sky-100 shadow-sm flex-shrink-0">
                            <AvatarImage src={friend.photoURL} alt={name} className="object-cover" />
                            <AvatarFallback className="bg-sky-100 text-sm font-bold text-sky-700">
                              {name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                              {name}
                            </p>
                            {subtitle && <p className="text-xs text-slate-500 truncate mt-0.5">{subtitle}</p>}
                          </div>
                          {friend.location?.name && (
                            <span className="flex-shrink-0 flex items-center gap-1 rounded-full bg-sky-400/10 px-2.5 py-1 text-[10px] font-semibold text-sky-600 ring-1 ring-sky-400/20 max-w-[120px] truncate">
                              📍 {friend.location.name}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="mt-6 space-y-3 rounded-[1.5rem] bg-white/60 ring-1 ring-sky-400/10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-800" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Visibility
                </h2>
                <p className="text-xs text-slate-500">Quick privacy controls for your campus presence.</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowPrivacySettings(true)}
                className="h-8 rounded-full px-3 text-xs text-sky-500 hover:bg-sky-50"
              >
                More
              </Button>
            </div>

            <ToggleRow
              label="Ghost Mode"
              description="Hide completely from maps and discovery."
              checked={privacySettings.ghostMode}
              onCheckedChange={(checked) => handlePrivacyChange('ghostMode', checked)}
            />
            <ToggleRow
              label="Location Sharing"
              description="Let friends see where you are on campus."
              checked={privacySettings.locationVisible}
              onCheckedChange={(checked) => handlePrivacyChange('locationVisible', checked)}
            />
          </section>

          {isEditing && (
            <section ref={editSectionRef} className="mt-6 space-y-5 rounded-[1.5rem] bg-white/70 ring-1 ring-sky-400/10 p-4 sm:p-5">
              <div>
                <h2 className="text-base font-bold text-slate-800" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Edit Details
                </h2>
                <p className="text-xs text-slate-500">Tune your identity card without leaving the profile view.</p>
              </div>

              <div className="flex flex-col items-center justify-center gap-3 mb-6 p-5 rounded-[1.25rem] bg-sky-50/50 border border-sky-100">
                <Avatar className="h-20 w-20 shadow-md border-4 border-white">
                   <AvatarImage src={profileData.photoURL} className="object-cover" />
                   <AvatarFallback className="bg-sky-100 text-xl font-bold text-sky-700">{displayName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex items-center gap-2 mt-1">
                  <Button type="button" variant="outline" size="sm" onClick={handlePickPhoto} className="text-sky-600 border-sky-200 hover:bg-sky-100 hover:text-sky-700 font-bold rounded-xl shadow-sm transition-colors">
                    <Camera className="h-4 w-4 mr-2" />
                    Change
                  </Button>
                  {profileData.photoURL && (
                    <Button type="button" variant="outline" size="sm" onClick={handleRemovePhoto} disabled={photoUploading} className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 font-bold rounded-xl shadow-sm transition-colors px-3">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name">
                  <Input value={profileData.name} onChange={(e) => handleInputChange('name', e.target.value)} />
                </Field>
                <Field label="Email">
                  <Input value={profileData.email} onChange={(e) => handleInputChange('email', e.target.value)} />
                </Field>
                {/* University is locked after initial selection and cannot be changed */}
                <Field label="University">
                  <div className="flex items-center gap-2 h-10 rounded-xl border border-sky-400/20 bg-sky-50/60 px-3.5 cursor-not-allowed">
                    <span className="flex-1 text-sm font-semibold text-slate-700 truncate">
                      {profileData.university || 'Not set'}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-[#A8AEB2]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                      <span className="text-[10px] font-bold text-[#A8AEB2] uppercase tracking-wider">Locked</span>
                    </div>
                  </div>
                  <p className="mt-1 text-[10px] text-[#A8AEB2] px-1">University cannot be changed after registration.</p>
                </Field>
                <Field label="Passing Year">
                  <Input value={profileData.year} onChange={(e) => handleInputChange('year', e.target.value)} />
                </Field>
                <Field label="Program">
                  <Input value={profileData.major} onChange={(e) => handleInputChange('major', e.target.value)} />
                </Field>

              </div>

              {profileData.major === 'OTHER' && (
                <Field label="Specify Program">
                  <Input value={majorOther} onChange={(e) => setMajorOther(e.target.value)} placeholder="E.g. MSc Data Science" />
                </Field>
              )}

              <Field label="Bio">
                <textarea
                  value={profileData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border border-sky-400/20 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-400"
                  placeholder="Write something warm, specific, and useful."
                />
              </Field>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-slate-700">Clubs</Label>
                  <button type="button" onClick={handleAddInterest} className="text-sm font-semibold text-sky-500 hover:text-sky-600">
                    + Add
                  </button>
                </div>
                {profileData.interests.map((interest, index) => (
                  <div key={index} className="flex items-center gap-2.5">
                    <Input value={interest} onChange={(e) => handleInterestChange(index, e.target.value)} />
                    <button
                      type="button"
                      onClick={() => handleRemoveInterest(index)}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="h-11 w-full rounded-2xl bg-sky-400 text-sm font-bold text-white hover:bg-sky-500 shadow-[0_10px_15px_-3px_rgba(56,189,248,0.3),0_4px_6px_-4px_rgba(56,189,248,0.3)]"
                data-testid="profile-save-details-btn"
              >
                {saving ? 'Saving...' : 'Save Profile Settings'}
              </Button>
            </section>
          )}
          {/* Account actions */}
          <section className="mt-6 rounded-[1.5rem] bg-white/60 ring-1 ring-sky-400/10 overflow-hidden">
            <button
              type="button"
              onClick={() => {
                if (onLogout) onLogout();
              }}
              data-testid="profile-logout-row"
              className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-rose-50/60 transition"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 ring-1 ring-rose-500/20">
                  <LogOut className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-rose-600" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    Log out
                  </p>
                  <p className="text-xs text-slate-500">Sign out of your account.</p>
                </div>
              </div>
              <span className="text-slate-400 text-lg">›</span>
            </button>
          </section>

          <p
            className="mt-4 mb-0 text-center text-xs"
            style={{ color: '#0795ed', fontFamily: "'Plus Jakarta Sans', sans-serif", boxSizing: 'content-box', fontWeight: 700 }}
          >
            By Ghosh Dynamics
          </p>
        </div>
      </section>

      {/* Image cropper modal */}
      <ImageCropper
        open={cropOpen}
        imageSrc={cropSrc}
        onCancel={handleCropCancel}
        onCropComplete={handleCropDone}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-slate-700">{label}</Label>
      {children}
    </div>
  );
}

function InfoChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200/70 bg-white/70 p-4 shadow-[0_10px_30px_rgba(148,163,184,0.08)]">
      <div className="flex items-center gap-2 text-sky-600">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-bold uppercase tracking-[0.18em]">{label}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-surface-container-low/80 px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
