import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../utils/firebase/client';
import { type ParsedClass } from '../utils/timetableParser';

export interface TimetableEntry extends ParsedClass {
  id?: string;
}

interface CacheData {
  timestamp: number;
  data: TimetableEntry[];
}

const CACHE_KEY_PREFIX = '@timetable_cache_';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// --- LocalStorage Helpers ---

const getCacheKey = (userId: string) => `${CACHE_KEY_PREFIX}${userId}`;

export const getCachedTimetable = async (userId: string): Promise<CacheData | null> => {
  try {
    const cachedString = localStorage.getItem(getCacheKey(userId));
    if (!cachedString) return null;
    return JSON.parse(cachedString) as CacheData;
  } catch (error) {
    console.error('Error reading timetable cache:', error);
    return null;
  }
};

export const setCachedTimetable = async (userId: string, data: TimetableEntry[]) => {
  try {
    const cacheData: CacheData = {
      timestamp: Date.now(),
      data,
    };
    localStorage.setItem(getCacheKey(userId), JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error setting timetable cache:', error);
  }
};

export const isCacheExpired = (timestamp: number) => {
  return Date.now() - timestamp > CACHE_EXPIRY_MS;
};

// --- Helper: Data Comparison ---

const isTimetableEqual = (oldData: TimetableEntry[], newData: TimetableEntry[]) => {
  if (oldData.length !== newData.length) return false;
  
  const sortFn = (a: TimetableEntry, b: TimetableEntry) => {
    const aKey = `${a.day}-${a.startTime}-${a.courseCode}`;
    const bKey = `${b.day}-${b.startTime}-${b.courseCode}`;
    return aKey.localeCompare(bKey);
  };
  
  const sortedOld = [...oldData].sort(sortFn);
  const sortedNew = [...newData].sort(sortFn);
  
  return JSON.stringify(sortedOld) === JSON.stringify(sortedNew);
};

// --- Firestore Fetch ---

export const fetchTimetableFromFirestore = async (userId: string): Promise<TimetableEntry[]> => {
  try {
    const q = query(collection(db, 'timetables'), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    
    const timetable: TimetableEntry[] = [];
    querySnapshot.forEach((doc) => {
      timetable.push({ id: doc.id, ...doc.data() } as TimetableEntry);
    });
    
    return timetable;
  } catch (error) {
    console.error('Error fetching timetable from Firestore:', error);
    throw error;
  }
};

// --- Main Custom Hook ---

export const useTimetableCache = (userId: string | undefined) => {
  const [data, setData] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadTimetable = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const cached = await getCachedTimetable(userId);
      let hasValidCache = false;

      if (cached) {
        setData(cached.data);
        setLoading(false);
        hasValidCache = true;
      } else {
        setLoading(true);
      }

      const shouldSync = !cached || isCacheExpired(cached.timestamp);
      
      if (shouldSync) {
        if (hasValidCache) setIsBackgroundSyncing(true);
        
        const freshData = await fetchTimetableFromFirestore(userId);
        
        if (!cached || !isTimetableEqual(cached.data, freshData)) {
          setData(freshData);
          await setCachedTimetable(userId, freshData);
        }
        
        setIsBackgroundSyncing(false);
      }

    } catch (err: any) {
      setError(err.message || 'Failed to load timetable');
      setIsBackgroundSyncing(false);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadTimetable();
  }, [loadTimetable]);

  const forceRefresh = async () => {
    if (!userId) return;
    
    setIsBackgroundSyncing(true);
    try {
      const freshData = await fetchTimetableFromFirestore(userId);
      setData(freshData);
      await setCachedTimetable(userId, freshData);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to refresh timetable');
    } finally {
      setIsBackgroundSyncing(false);
    }
  };

  return {
    data,
    loading,
    isBackgroundSyncing,
    error,
    forceRefresh
  };
};
