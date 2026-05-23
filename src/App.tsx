import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LoginPage } from './features/auth/components/LoginPage';
import { formatEmailToName } from './utils/nameUtils';
import { AppRouter } from './app/routes/AppRouter';
import { LandingPage } from './features/landing/components/LandingPage';

const AdminPanel = React.lazy(() => import('./features/admin/components/AdminPanel').then(m => ({ default: m.AdminPanel })));

import { TimetableWidget } from './features/timetable/components/TimetableWidget';
import { usePushNotifications } from './hooks/usePushNotifications';
import { auth, isFirebaseConfigured } from './utils/firebase/client';
import { getUserProfile, createUserProfile, getProfile, updateProfile as upsertProfileDoc, uploadUserPublicKey, getAdminUser, getAllNotificationsRealtime, type UserProfile } from './utils/firebase/firestore';
import { onAuthStateChanged, sendEmailVerification } from 'firebase/auth';
import { Timestamp, doc, updateDoc } from 'firebase/firestore';
import { initializeE2EE } from './utils/crypto';
import { Toaster, toast } from 'sonner';
import { UniversityProvider } from './hooks/useUniversity';
import { SplashScreen } from './components/common/SplashScreen';
import { UniversityPicker } from './components/common/UniversityPicker';
import { type UniversityConfig, getUniversityConfig, DEFAULT_UNIVERSITY_ID } from './config/universities';
import { db } from './utils/firebase/client';



export default function App() {
  function PageSkeleton() {
    return (
      <div className="w-full space-y-6 animate-pulse p-4 md:p-0">
        <div className="h-12 bg-slate-200 rounded-2xl w-3/4 mx-auto" />
        <div className="space-y-4">
          <div className="h-48 bg-slate-100 rounded-[32px] w-full" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-32 bg-slate-100 rounded-3xl w-full" />
            <div className="h-32 bg-slate-100 rounded-3xl w-full" />
          </div>
          <div className="h-64 bg-slate-100 rounded-[32px] w-full" />
        </div>
      </div>
    );
  }

  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [showAuthFlow, setShowAuthFlow] = useState<boolean>(false);
  const [needsUniversitySelection, setNeedsUniversitySelection] = useState<boolean>(false);
  // University chosen BEFORE account creation – stored in localStorage permanently
  const [preLoginUniversity, setPreLoginUniversity] = useState<UniversityConfig | null>(() => {
    try {
      const saved = localStorage.getItem('uninest_selected_university');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<string>('home');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(!isFirebaseConfigured);
  const [viewedProfile, setViewedProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastNotificationId, setLastNotificationId] = useState<string | null>(null);
  const pageHistoryRef = useRef<string[]>([]);

  // Resolve university config reactively based on current user's universityId
  const university = React.useMemo(() => {
    return getUniversityConfig(currentUser?.universityId || DEFAULT_UNIVERSITY_ID);
  }, [currentUser?.universityId]);

  // Navigate to a page with history tracking (Removed for react-router)
  const navigateTo = useCallback((page: string) => {
    // Legacy support for fallback cases
    setCurrentPage(page);
  }, []);

  // Go back to the previous page in history (Removed for react-router)
  const goBack = useCallback(() => {
    // Legacy support
    setCurrentPage('home');
  }, []);

  // Setup native push notifications
  usePushNotifications(currentUser?.uid);

  // Listen for global admin notifications
  useEffect(() => {
    if (!isFirebaseConfigured) return;

    const unsubscribe = getAllNotificationsRealtime((notifications) => {
      if (notifications.length > 0) {
        const latest = notifications[0]; // Ordered by createdAt desc
        
        // If it's a new notification we haven't seen in this session
        if (lastNotificationId && latest.id !== lastNotificationId && latest.status === 'sent') {
          toast(latest.title, {
            description: latest.message,
            duration: 5000,
          });
        }
        setLastNotificationId(latest.id || null);
      }
    });

    return () => unsubscribe();
  }, [lastNotificationId]);

  // Handle authentication state changes and load user data
  useEffect(() => {
    if (isFirebaseConfigured) {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          // If user is not verified, try to reload once to check for fresh status
          let verified = user.emailVerified;
          if (!verified) {
            try {
              await user.reload();
              // Access the fresh state from auth.currentUser after reload
              verified = auth.currentUser?.emailVerified || false;
            } catch (e) {
              console.error('Failed to reload user on auth change:', e);
            }
          }
          setIsEmailVerified(verified);

          if (!verified) {
            // Keep user signed in but block access to app pages until verification completes
            setCurrentUser({
              uid: user.uid,
              name: formatEmailToName(user.displayName || user.email),
              displayName: user.displayName || formatEmailToName(user.displayName || user.email),
              email: user.email || '',
              createdAt: Timestamp.now(),
              isDevelopmentUser: false
            });
            setIsAdmin(false);
            setIsLoggedIn(true);
            setNeedsUniversitySelection(false);
            setLoading(false);
            return;
          }

          // User is signed in, load their profile data
          try {
            // Load both collections: users (displayName) and profiles (name)
            const [userProfile, profileDoc] = await Promise.all([
              getUserProfile(user.uid),
              getProfile(user.uid)
            ]);

            if (userProfile || profileDoc) {
              // If user exists in profiles but not in users, sync it now
              if (!userProfile && profileDoc) {
                console.log('Syncing profile to users collection...');
                await createUserProfile(user, {
                  name: profileDoc.name,
                  university: profileDoc.university,
                  universityId: profileDoc.universityId,
                  year: profileDoc.year,
                  major: profileDoc.major
                });
              }
              // If user exists in users but not in profiles, sync it now
              if (!profileDoc && userProfile) {
                console.log('Syncing users to profile collection...');
                await upsertProfileDoc(user.uid, {
                  name: userProfile.name || userProfile.displayName || formatEmailToName(user.displayName || user.email),
                  email: userProfile.email || user.email,
                  university: userProfile.university || preLoginUniversity?.name || '',
                  universityId: userProfile.universityId || preLoginUniversity?.id || '',
                  year: userProfile.year || '',
                  major: userProfile.major || ''
                });
              }

              const registeredName = (profileDoc as any)?.name;
              const resolvedName = registeredName || formatEmailToName(userProfile?.displayName || user.displayName || user.email);

              // Check if user is admin
              const adminData = await getAdminUser(user.uid);
              setIsAdmin(!!adminData);

              const resolvedUniversityId = userProfile?.universityId || (profileDoc as any)?.universityId || null;

              setCurrentUser({
                uid: user.uid,
                name: resolvedName,
                displayName: resolvedName,
                email: userProfile?.email || (profileDoc as any)?.email || user.email || '',
                university: userProfile?.university || (profileDoc as any)?.university,
                universityId: resolvedUniversityId,
                year: userProfile?.year || (profileDoc as any)?.year,
                major: userProfile?.major || (profileDoc as any)?.major,
                location: userProfile?.location,
                photoURL: (profileDoc as any)?.photoURL || (userProfile as any)?.photoURL || user.photoURL || undefined,
                isAdmin: !!adminData,
                isDevelopmentUser: false,
                createdAt: userProfile?.createdAt || (profileDoc as any)?.createdAt || Timestamp.now()
              });
              setIsLoggedIn(true);

              // If user hasn't selected a university yet, show the picker
              if (!resolvedUniversityId) {
                setNeedsUniversitySelection(true);
              }
            } else {
              // User docs don't exist yet — this is a newly verified account.
              // Read the profile data the user filled in during signup (stored in
              // sessionStorage so we don't create Firestore docs before verification).
              console.log('Verified user has no docs, creating users + profiles for:', user.uid);

              let pendingProfile: Record<string, string> = {};
              try {
                const raw = sessionStorage.getItem('uninest_pending_profile');
                if (raw) {
                  pendingProfile = JSON.parse(raw);
                  sessionStorage.removeItem('uninest_pending_profile'); // consume it
                }
              } catch {}

              const bootstrapData = {
                name: pendingProfile.name || formatEmailToName(user.displayName || user.email),
                email: pendingProfile.email || user.email || undefined,
                university: pendingProfile.university || preLoginUniversity?.name || '',
                universityId: pendingProfile.universityId || preLoginUniversity?.id || '',
                year: pendingProfile.year || '',
                major: pendingProfile.major || ''
              };
              await Promise.all([
                createUserProfile(user, bootstrapData),
                upsertProfileDoc(user.uid, bootstrapData)
              ]);

              setCurrentUser({
                uid: user.uid,
                name: bootstrapData.name,
                displayName: bootstrapData.name,
                email: bootstrapData.email || '',
                photoURL: user.photoURL || undefined,
                university: bootstrapData.university || undefined,
                universityId: bootstrapData.universityId || undefined,
                createdAt: Timestamp.now(),
              } as UserProfile);
              setIsLoggedIn(true);
              // If no university could be resolved, show picker
              setNeedsUniversitySelection(!bootstrapData.universityId);
            }

            // Always attempt E2EE initialization for signed-in users
            try {
              const pubJWK = await initializeE2EE();
              if (pubJWK) {
                await uploadUserPublicKey(pubJWK);
                console.log('E2EE initialized and public key uploaded automatically.');
              }
            } catch (e) {
              console.error('Failed to initialize E2EE keys:', e);
            }
          } catch (error) {
            console.error('Error loading user profile:', error);
            // Fallback to basic auth data
            setCurrentUser({
              uid: user.uid,
              name: formatEmailToName(user.displayName || user.email),
              displayName: user.displayName || formatEmailToName(user.displayName || user.email),
              email: user.email || '',
              createdAt: Timestamp.now(),
              isDevelopmentUser: false
            });
            setIsLoggedIn(true);
          }
        } else {
          // User is signed out
          setCurrentUser(null);
          setIsLoggedIn(false);
          setIsEmailVerified(true);
        }
        setLoading(false);
      });

      return () => unsubscribe();
    } else {
      // Development mode - check localStorage for demo user
      const savedUser = localStorage.getItem('userProfile');
      if (savedUser) {
        try {
          const userData = JSON.parse(savedUser);
          setCurrentUser({ ...userData, isDevelopmentUser: true });
          setIsAdmin(!!userData.isAdmin);
          setIsLoggedIn(true);
        } catch (error) {
          console.error('Error parsing saved user data:', error);
        }
      }
      setLoading(false);
    }
  }, []);

  const handleLogin = (userData: any) => {
    // Merge preLoginUniversity into userData if the user doesn't have one yet
    const mergedUniversityId = userData.universityId || preLoginUniversity?.id || null;
    const mergedUniversityName = userData.university || preLoginUniversity?.name || null;

    const mergedUser = {
      ...userData,
      universityId: mergedUniversityId,
      university: mergedUniversityName,
    };

    setCurrentUser(mergedUser);
    setIsAdmin(!!userData.isAdmin);
    setIsLoggedIn(true);

    // If universityId resolved (either from profile or pre-login choice), go home
    if (mergedUniversityId) {
      setCurrentPage('home');
    } else {
      // Still no university – show post-login picker as fallback
      setNeedsUniversitySelection(true);
    }

    // Save to localStorage in development mode
    if (!isFirebaseConfigured && userData.isDevelopmentUser) {
      localStorage.setItem('userProfile', JSON.stringify(mergedUser));
    }
  };

  /** Called when the user picks a university PRE-login (first-time onboarding) */
  const handlePreLoginUniversitySelect = (uni: UniversityConfig) => {
    // Persist permanently so the choice survives across sessions
    localStorage.setItem('uninest_selected_university', JSON.stringify(uni));
    setPreLoginUniversity(uni);
  };

  /** Called when the user picks a university from the UniversityPicker (post-login fallback) */
  const handleUniversitySelect = async (uni: UniversityConfig) => {
    try {
      // Persist pre-login choice to localStorage as well (so it's always locked)
      localStorage.setItem('uninest_selected_university', JSON.stringify(uni));
      setPreLoginUniversity(uni);

      // Save to Firestore
      if (isFirebaseConfigured && auth.currentUser) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userRef, { universityId: uni.id, university: uni.name });
        // Also update profiles collection if it exists
        try {
          const profileRef = doc(db, 'profiles', auth.currentUser.uid);
          await updateDoc(profileRef, { universityId: uni.id, university: uni.name });
        } catch { /* profiles doc may not exist yet */ }
      }
      // Update local state
      setCurrentUser((prev: any) => ({ ...prev, universityId: uni.id, university: uni.name }));
      setNeedsUniversitySelection(false);
      setCurrentPage('home');
      toast.success(`Welcome to UniNest at ${uni.shortName}! 🎉`);
    } catch (err) {
      console.error('Error saving university selection:', err);
      toast.error('Could not save your university. Please try again.');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsLoggedIn(false);
    setIsEmailVerified(true);
    setCurrentPage('home');
    pageHistoryRef.current = [];

    // Clear localStorage in development mode
    if (!isFirebaseConfigured) {
      localStorage.removeItem('userProfile');
    }

    // Sign out from Firebase if configured
    if (isFirebaseConfigured && auth.currentUser) {
      auth.signOut();
    }
  };

  const handleProfileUpdate = (updatedUser: UserProfile) => {
    setCurrentUser(updatedUser);
    console.log('🔄 App: Updated currentUser state with profile changes:', updatedUser);
  };

  // Standalone widget route — short-circuits the main app shell.
  // Placed after all hooks to comply with React's Rules of Hooks.
  if (typeof window !== 'undefined' && window.location.pathname.replace(/\/$/, '') === '/widget') {
    return <TimetableWidget />;
  }

  // Standalone admin dashboard route (via path OR via environment variable for dedicated deployment)
  const isAdminApp = import.meta.env.VITE_IS_ADMIN_APP === 'true';
  const isAdminRoute = typeof window !== 'undefined' && window.location.pathname.replace(/\/$/, '') === '/admin';
  const isWebRoot = isAdminApp && typeof window !== 'undefined' && window.location.pathname === '/';
  
  if (isWebRoot) {
    return (
      <LandingPage onJoinClick={() => {
        window.location.href = '/admin';
      }} />
    );
  }

  if (isAdminRoute || (isAdminApp && !isWebRoot)) {
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
        </div>
      );
    }
    if (!isLoggedIn) {
      return <LoginPage onLogin={handleLogin} selectedUniversity={preLoginUniversity} />;
    }
    if (!isAdmin) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">🔒</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-6">You must be an administrator to view this dashboard.</p>
          {!isAdminApp && (
            <button 
              onClick={() => window.location.href = '/'} 
              className="px-6 py-2.5 rounded-full bg-sky-600 text-white font-bold hover:bg-sky-700 transition-colors"
            >
              Return to App
            </button>
          )}
        </div>
      );
    }
    return (
      <UniversityProvider value={university}>
        <div className="h-[100dvh] w-full bg-slate-50 overflow-y-auto">
          <React.Suspense fallback={<PageSkeleton />}>
            <AdminPanel />
          </React.Suspense>
        </div>
      </UniversityProvider>
    );
  }

  // Show splash screen on cold start
  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  // Show loading state while determining authentication status
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // ── Step 1: Unauthenticated Landing Page + Auth Flow Overlay ──
  if (!isLoggedIn) {
    return (
      <div className="relative min-h-screen">
        <LandingPage onJoinClick={() => setShowAuthFlow(true)} />
        
        {/* Onboarding / Login Modal Overlay */}
        {showAuthFlow && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" 
              onClick={() => setShowAuthFlow(false)} 
            />
            <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 z-10 max-h-[90dvh] flex flex-col">
              <button 
                onClick={() => setShowAuthFlow(false)}
                className="absolute top-6 right-6 w-9 h-9 rounded-full bg-slate-150 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white font-extrabold z-50 text-xs shadow-sm transition-all"
                aria-label="Close"
              >
                ✕
              </button>
              
              <div className="flex-1 overflow-y-auto no-scrollbar relative">
                {!preLoginUniversity ? (
                  <UniversityPicker 
                    onSelect={(uni) => {
                      handlePreLoginUniversitySelect(uni);
                    }} 
                    isPreLogin={true} 
                  />
                ) : (
                  <>
                    <button
                      onClick={() => setPreLoginUniversity(null)}
                      className="absolute top-8 left-6 z-40 text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1.5 transition-all"
                    >
                      ← Change Uni
                    </button>
                    <LoginPage 
                      onLogin={(profile) => {
                        handleLogin(profile);
                        setShowAuthFlow(false);
                      }} 
                      selectedUniversity={preLoginUniversity} 
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (isFirebaseConfigured && !isEmailVerified) {
    const handleResendVerificationEmail = async () => {
      if (!auth.currentUser) return;
      try {
        await sendEmailVerification(auth.currentUser);
        toast.success('Verification email sent again. Please check inbox and spam folder.');
      } catch (e) {
        console.error('Failed to resend verification email:', e);
        toast.error('Could not resend verification email. Please try again.');
      }
    };

    const handleVerificationRefresh = async () => {
      if (!auth.currentUser) return;
      try {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          setIsEmailVerified(true);
          setCurrentPage('home');
          toast.success('Email verified! Welcome to UniNest. 🎉');
        } else {
          toast.error('Email not verified yet.', {
            description: 'Please check your inbox (and spam folder) for the verification link.'
          });
        }
      } catch (e) {
        console.error('Failed to refresh verification status:', e);
        toast.error('Could not check verification status. Please try again.');
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f1f7fb] px-6">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-[0_18px_36px_rgba(0,98,134,0.12)] border border-sky-100">
          <h1 className="text-2xl font-extrabold text-slate-800 mb-3" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Verify Your Email
          </h1>
          <p className="text-sm text-slate-600 leading-6">
            Your account is created, but email verification is still pending.
            Please verify your email before opening the homepage.
          </p>
          <p className="text-sm text-slate-600 leading-6 mt-3">
            If you cannot find the email, check your spam/junk folder.
          </p>
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleResendVerificationEmail}
              className="px-4 py-2 rounded-xl bg-white text-sky-600 border border-sky-200 text-sm font-semibold hover:bg-sky-50 transition-colors"
            >
              Resend Email
            </button>
            <button
              onClick={handleVerificationRefresh}
              className="px-4 py-2 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 transition-colors"
            >
              I Verified, Continue
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 3 (fallback): Post-login picker if Firestore has no universityId ──
  if (needsUniversitySelection) {
    return <UniversityPicker onSelect={handleUniversitySelect} />;
  }

  // Final render uses the new AppRouter
  return (
    <UniversityProvider value={university}>
      <Toaster position="top-right" />
      <AppRouter
        currentUser={currentUser}
        handleLogout={handleLogout}
        handleProfileUpdate={handleProfileUpdate}
      />
    </UniversityProvider>
  );
}
