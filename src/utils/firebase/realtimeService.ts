/**
 * realtimeService.ts — High-Performance Real-Time Feed Service
 *
 * Implements highly optimized onSnapshot listeners for Events and Status (Pulses),
 * replacing slow getDocs calls with real-time paginated streams.
 * Features:
 * - limit(20) for initial loads
 * - Pagination via loadMoreEvents / loadMoreStatus
 * - Local caching
 * - Strict query filters (collegeId, expiresAt)
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  startAfter,
  QueryDocumentSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from './client';
import { CampusEvent, Pulse } from './firestore'; // import types

const EVENT_PAGE_SIZE = 20;
const STATUS_PAGE_SIZE = 20;

// ─── Cache & Cursors ────────────────────────────────────────────────────────

const eventsCache = new Map<string, CampusEvent[]>();
const oldestEventCursor = new Map<string, QueryDocumentSnapshot | null>();

const statusCache = new Map<string, Pulse[]>();
const oldestStatusCursor = new Map<string, QueryDocumentSnapshot | null>();

// ─── Events Real-Time Pagination ────────────────────────────────────────────

/**
 * Listen to real-time events, optimized with index: collegeId + createdAt.
 * Initial load is limited to EVENT_PAGE_SIZE.
 */
export function listenToEvents(
  collegeId: string,
  onUpdate: (events: CampusEvent[]) => void,
  pageSize: number = EVENT_PAGE_SIZE
): () => void {
  if (!isFirebaseConfigured || !collegeId) return () => {};

  const q = query(
    collection(db, 'events'),
    where('collegeId', '==', collegeId),
    orderBy('createdAt', 'desc'),
    limit(pageSize)
  );

  return onSnapshot(q, (snapshot) => {
    const incoming: CampusEvent[] = [];
    let oldest: QueryDocumentSnapshot | null = null;

    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      if (data.brandName === undefined) { // filter out ads if mixed in
        incoming.push({ id: docSnap.id, ...data } as CampusEvent);
      }
      oldest = docSnap;
    });

    if (oldest) oldestEventCursor.set(collegeId, oldest);
    
    // Merge into cache keeping it sorted
    eventsCache.set(collegeId, incoming);
    onUpdate(incoming);
  }, (error) => {
    console.error('listenToEvents error:', error);
    onUpdate(eventsCache.get(collegeId) || []);
  });
}

/**
 * Paginate older events (scroll down).
 */
export async function loadMoreEvents(collegeId: string): Promise<CampusEvent[]> {
  if (!isFirebaseConfigured || !collegeId) return [];

  const cursor = oldestEventCursor.get(collegeId);
  if (!cursor) return [];

  const q = query(
    collection(db, 'events'),
    where('collegeId', '==', collegeId),
    orderBy('createdAt', 'desc'),
    startAfter(cursor),
    limit(EVENT_PAGE_SIZE)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    oldestEventCursor.set(collegeId, null);
    return eventsCache.get(collegeId) || [];
  }

  const older: CampusEvent[] = [];
  let newOldest: QueryDocumentSnapshot | null = null;

  snapshot.docs.forEach(docSnap => {
    const data = docSnap.data();
    if (data.brandName === undefined) {
      older.push({ id: docSnap.id, ...data } as CampusEvent);
    }
    newOldest = docSnap;
  });

  if (newOldest) oldestEventCursor.set(collegeId, newOldest);

  const current = eventsCache.get(collegeId) || [];
  const merged = [...current, ...older]; // Since we append older items at the end
  eventsCache.set(collegeId, merged);
  return merged;
}

export function hasMoreEvents(collegeId: string): boolean {
  return oldestEventCursor.get(collegeId) !== null;
}

// ─── Status (Pulses) Real-Time Pagination ───────────────────────────────────

/**
 * Listen to real-time status/pulses, optimized with index: expiresAt (to filter out expired).
 */
export function listenToStatus(
  onUpdate: (statusList: Pulse[]) => void,
  pageSize: number = STATUS_PAGE_SIZE
): () => void {
  if (!isFirebaseConfigured || !auth.currentUser) return () => {};

  const q = query(
    collection(db, 'status'), // Assuming pulses will migrate to 'status' or be aliased
    where('expiresAt', '>', Timestamp.now()),
    orderBy('expiresAt', 'asc'), // Need to order by the inequality field first
    limit(pageSize)
  );

  return onSnapshot(q, (snapshot) => {
    const incoming: Pulse[] = [];
    let oldest: QueryDocumentSnapshot | null = null;

    snapshot.docs.forEach(docSnap => {
      incoming.push({ id: docSnap.id, ...(docSnap.data() as any) } as Pulse);
      oldest = docSnap;
    });

    if (oldest) oldestStatusCursor.set('global', oldest);
    
    // Sort by createdAt client-side if needed, since Firestore forces order by expiresAt
    incoming.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    
    statusCache.set('global', incoming);
    onUpdate(incoming);
  }, (error) => {
    console.error('listenToStatus error:', error);
    onUpdate(statusCache.get('global') || []);
  });
}

/** Load more status/pulses */
export async function loadMoreStatus(): Promise<Pulse[]> {
  if (!isFirebaseConfigured) return [];

  const cursor = oldestStatusCursor.get('global');
  if (!cursor) return [];

  const q = query(
    collection(db, 'status'),
    where('expiresAt', '>', Timestamp.now()),
    orderBy('expiresAt', 'asc'),
    startAfter(cursor),
    limit(STATUS_PAGE_SIZE)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    oldestStatusCursor.set('global', null);
    return statusCache.get('global') || [];
  }

  const older: Pulse[] = [];
  let newOldest: QueryDocumentSnapshot | null = null;

  snapshot.docs.forEach(docSnap => {
    older.push({ id: docSnap.id, ...(docSnap.data() as any) } as Pulse);
    newOldest = docSnap;
  });

  if (newOldest) oldestStatusCursor.set('global', newOldest);

  const current = statusCache.get('global') || [];
  const merged = [...current, ...older];
  // Sort again
  merged.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
  
  statusCache.set('global', merged);
  return merged;
}

export function hasMoreStatus(): boolean {
  return oldestStatusCursor.get('global') !== null;
}
