/**
 * University Context & Hook
 * -------------------------
 * Provides the current user's university config to any component in the tree.
 *
 * Usage:
 *   // In App.tsx (top-level):
 *   const university = useResolveUniversity();
 *   <UniversityProvider value={university}> ... </UniversityProvider>
 *
 *   // In any child component:
 *   const university = useUniversity();
 *   console.log(university.campusLabel); // 'VIT Campus'
 */

import { useState, useEffect, createContext, useContext } from 'react';
import { type User } from 'firebase/auth';
import {
  getUniversityConfig,
  DEFAULT_UNIVERSITY_ID,
  type UniversityConfig,
} from '../config/universities';
import { auth } from '../utils/firebase/client';
import { getProfile } from '../utils/firebase/firestore';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const UniversityContext = createContext<UniversityConfig>(
  getUniversityConfig(DEFAULT_UNIVERSITY_ID)
);

/** Wrap the app tree with this provider (see App.tsx). */
export const UniversityProvider = UniversityContext.Provider;

/**
 * Read the current university config from context.
 * Must be used inside a <UniversityProvider>.
 */
export function useUniversity(): UniversityConfig {
  return useContext(UniversityContext);
}

// ---------------------------------------------------------------------------
// Resolver hook (used once at the App level)
// ---------------------------------------------------------------------------

/**
 * Resolves the signed-in user's university from their Firestore profile.
 * Returns the matching UniversityConfig (defaults to VIT Vellore).
 *
 * This hook should be called ONCE in App.tsx; its value is then
 * passed into <UniversityProvider value={...}>.
 */
export function useResolveUniversity(): UniversityConfig {
  const [config, setConfig] = useState<UniversityConfig>(
    getUniversityConfig(DEFAULT_UNIVERSITY_ID)
  );

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user: User | null) => {
      if (user) {
        try {
          const profile = await getProfile(user.uid);
          const uniId =
            (profile as any)?.universityId ||
            (profile as any)?.university ||
            DEFAULT_UNIVERSITY_ID;
          setConfig(getUniversityConfig(uniId));
        } catch (err) {
          console.warn('useResolveUniversity: failed to load profile, using default', err);
          setConfig(getUniversityConfig(DEFAULT_UNIVERSITY_ID));
        }
      } else {
        // Signed out — reset to default
        setConfig(getUniversityConfig(DEFAULT_UNIVERSITY_ID));
      }
    });

    return unsub;
  }, []);

  return config;
}
