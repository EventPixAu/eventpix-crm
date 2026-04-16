import { useEffect, useState, useCallback } from 'react';
import type { Event, EventAssignment } from '@/hooks/useEvents';
import type { Database } from '@/integrations/supabase/types';

type Worksheet = Database['public']['Tables']['worksheets']['Row'];
type WorksheetItem = Database['public']['Tables']['worksheet_items']['Row'];
type DeliveryRecord = Database['public']['Tables']['delivery_records']['Row'];

export interface DayOfCacheData {
  event: Event;
  assignments: EventAssignment[];
  worksheets: Worksheet[];
  worksheetItems: WorksheetItem[];
  deliveryRecord: DeliveryRecord | null;
  cachedAt: string;
}

const CACHE_KEY_PREFIX = 'eventpix_dayof_';

export function useDayOfCache(eventId: string | undefined) {
  const [cachedData, setCachedData] = useState<DayOfCacheData | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  // Load cached data on mount
  useEffect(() => {
    if (!eventId) return;
    
    const cached = localStorage.getItem(`${CACHE_KEY_PREFIX}${eventId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as DayOfCacheData;
        setCachedData(parsed);
      } catch (e) {
        console.error('Failed to parse cached data:', e);
      }
    }
  }, [eventId]);

  // Save data to cache
  const saveToCache = useCallback((data: Omit<DayOfCacheData, 'cachedAt'>) => {
    if (!eventId) return;
    
    const cacheData: DayOfCacheData = {
      ...data,
      cachedAt: new Date().toISOString(),
    };
    
    try {
      localStorage.setItem(`${CACHE_KEY_PREFIX}${eventId}`, JSON.stringify(cacheData));
      // Only update state if we don't already have cached data to avoid infinite re-render loops
      setCachedData(prev => prev ? prev : cacheData);
    } catch (e) {
      console.error('Failed to save to cache:', e);
    }
  }, [eventId]);

  // Clear cache for event
  const clearCache = useCallback(() => {
    if (!eventId) return;
    localStorage.removeItem(`${CACHE_KEY_PREFIX}${eventId}`);
    setCachedData(null);
  }, [eventId]);

  // Set offline mode
  const setOfflineMode = useCallback((offline: boolean) => {
    setIsOffline(offline);
  }, []);

  return {
    cachedData,
    isOffline,
    saveToCache,
    clearCache,
    setOfflineMode,
  };
}
