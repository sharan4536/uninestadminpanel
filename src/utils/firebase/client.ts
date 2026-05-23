import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Production configuration only
const isUsingEmulators = false;
// Explicit opt-in flag to enable Firebase usage. Defaults to false in local/dev unless set.
const useFirebaseFlag = String((import.meta as any).env?.VITE_USE_FIREBASE || '').toLowerCase() === 'true';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_APP_ID?.split(':')[1],
};

// Log Firebase config for debugging (without sensitive data)
console.log('Firebase config check:', {
  apiKeyExists: Boolean(firebaseConfig.apiKey),
  authDomainExists: Boolean(firebaseConfig.authDomain),
  projectIdExists: Boolean(firebaseConfig.projectId),
  appIdExists: Boolean(firebaseConfig.appId),
  usingEmulators: isUsingEmulators
});

// Check if Firebase is properly configured and explicitly enabled
export const isFirebaseConfigured = !!useFirebaseFlag && Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId
);

// Initialize Firebase app
export const app = isFirebaseConfigured
  ? (getApps()[0] ?? initializeApp(firebaseConfig))
  : (undefined as any);

// Initialize Firebase services
export const auth = isFirebaseConfigured ? getAuth(app) : (undefined as any);
// Use long-polling transport for Firestore to prevent WebSocket stalls on Capacitor
export const db = isFirebaseConfigured 
  ? initializeFirestore(app, { experimentalForceLongPolling: true })
  : (undefined as any);

// Initialize Firebase Storage
export const storage = isFirebaseConfigured ? getStorage(app) : (undefined as any);

// Initialize Firebase Functions
import { getFunctions } from 'firebase/functions';
export const functions = isFirebaseConfigured ? getFunctions(app) : (undefined as any);

// No emulators in production mode
