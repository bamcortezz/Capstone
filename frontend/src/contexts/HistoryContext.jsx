import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from './AuthContext';
import Swal from 'sweetalert2';

// API URL
const API_URL = import.meta.env.VITE_API_URL;

const HistoryContext = createContext();

export const useHistory = () => useContext(HistoryContext);

export const HistoryProvider = ({ children }) => {
  const { getAuthHeaders, user } = useAuth();
  const [analyses, setAnalyses] = useState([]);
  const [archivedAnalyses, setArchivedAnalyses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [lastArchivedFetchTime, setLastArchivedFetchTime] = useState(null);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const [hasArchivedInitialLoad, setHasArchivedInitialLoad] = useState(false);
  const fetchPromiseRef = useRef(null);
  const fetchArchivedPromiseRef = useRef(null);

  // Cache duration: 5 minutes
  const CACHE_DURATION = 5 * 60 * 1000;
  const ARCHIVED_CACHE_DURATION = 5 * 60 * 1000; // Same as regular cache

  const isCacheValid = useCallback((lastTime, hasLoad) => {
    if (!lastTime || !hasLoad) return false;
    return Date.now() - lastTime < CACHE_DURATION;
  }, [CACHE_DURATION]);

  const isArchivedCacheValid = useCallback(() => {
    return isCacheValid(lastArchivedFetchTime, hasArchivedInitialLoad);
  }, [isCacheValid, lastArchivedFetchTime, hasArchivedInitialLoad]);
  
  const isActiveCacheValid = useCallback(() => {
    return isCacheValid(lastFetchTime, hasInitialLoad);
  }, [isCacheValid, lastFetchTime, hasInitialLoad]);

  const fetchArchivedAnalyses = useCallback(async (forceRefresh = false) => {
    // If we already have a fetch in progress, return that promise
    if (fetchArchivedPromiseRef.current && !forceRefresh) {
      return fetchArchivedPromiseRef.current;
    }

    // If cache is valid and we're not forcing refresh, return cached data
    if (isArchivedCacheValid() && !forceRefresh && hasArchivedInitialLoad) {
      return archivedAnalyses;
    }

    const fetchPromise = (async () => {
      try {
        setLoadingArchived(true);
        const response = await fetch(`${API_URL}/api/history/deleted`, {
          method: 'GET',
          headers: getAuthHeaders(),
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Failed to fetch archived analyses');
        }

        const data = await response.json();
        setArchivedAnalyses(data);
        setLastArchivedFetchTime(Date.now());
        setHasArchivedInitialLoad(true);
        return data;
      } catch (error) {
        console.error('Error fetching archived analyses:', error);
        
        // Only show error if this is the first load or a forced refresh
        if (!hasArchivedInitialLoad || forceRefresh) {
          Swal.fire({
            title: 'Error',
            text: 'Failed to load archived analyses',
            icon: 'error',
            background: '#18181b',
            color: '#fff',
            confirmButtonColor: '#9147ff'
          });
        }
        throw error;
      } finally {
        setLoadingArchived(false);
        fetchArchivedPromiseRef.current = null;
      }
    })();

    fetchArchivedPromiseRef.current = fetchPromise;
    return fetchPromise;
  }, [getAuthHeaders, isArchivedCacheValid, archivedAnalyses.length, hasArchivedInitialLoad]);

  const fetchAnalyses = useCallback(async (forceRefresh = false) => {
    // If we already have a fetch in progress, return that promise
    if (fetchPromiseRef.current && !forceRefresh) {
      return fetchPromiseRef.current;
    }

    // If cache is valid and we're not forcing refresh, return cached data
    // Note: We should return cached data even if it's empty (analyses.length === 0)
    if (isActiveCacheValid() && !forceRefresh && hasInitialLoad) {
      return analyses;
    }

    const fetchPromise = (async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/api/history`, {
          method: 'GET',
          headers: getAuthHeaders(),
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Failed to fetch analyses');
        }

        const data = await response.json();
        setAnalyses(data);
        setLastFetchTime(Date.now());
        setHasInitialLoad(true);
        return data;
      } catch (error) {
        console.error('Error fetching analyses:', error);
        
        // Only show error if this is the first load or a forced refresh
        if (!hasInitialLoad || forceRefresh) {
          Swal.fire({
            title: 'Error',
            text: 'Failed to load analysis history',
            icon: 'error',
            background: '#18181b',
            color: '#fff',
            confirmButtonColor: '#9147ff'
          });
        }
        throw error;
      } finally {
        setLoading(false);
        fetchPromiseRef.current = null;
      }
    })();

    fetchPromiseRef.current = fetchPromise;
    return fetchPromise;
  }, [getAuthHeaders, isActiveCacheValid, analyses.length, hasInitialLoad]);

  // Add a new analysis to the cache (called when a new analysis is saved)
  const addAnalysis = useCallback((newAnalysis) => {
    setAnalyses(prev => [newAnalysis, ...prev]);
    setLastFetchTime(Date.now());
  }, []);

  // Remove an analysis from the cache (called when an analysis is deleted)
  const removeAnalysis = useCallback((analysisId) => {
    setAnalyses(prev => prev.filter(analysis => analysis._id !== analysisId));
    setLastFetchTime(Date.now());
  }, []);

  // Restore an archived analysis
  const restoreAnalysis = useCallback(async (analysisId) => {
    try {
      const response = await fetch(`${API_URL}/api/history/${analysisId}/restore`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to restore analysis');
      }

      const restoredAnalysis = await response.json();
      
      // Invalidate the cache and force a refresh
      setLastFetchTime(0);
      
      // Update local state optimistically
      setArchivedAnalyses(prev => prev.filter(a => a._id !== analysisId));
      setAnalyses(prev => [restoredAnalysis, ...prev]);
      
      // Force a refresh of the active analyses
      await getAnalyses(true);
      
      return restoredAnalysis;
    } catch (error) {
      console.error('Error restoring analysis:', error);
      Swal.fire({
        title: 'Error',
        text: 'Failed to restore analysis',
        icon: 'error',
        background: '#18181b',
        color: '#fff',
        confirmButtonColor: '#9147ff'
      });
      throw error;
    }
  }, [getAuthHeaders]);

  // Force refresh the cache (useful for manual refresh)
  const refreshAnalyses = useCallback(() => {
    return fetchAnalyses(true);
  }, [fetchAnalyses]);

  // Get analyses with automatic loading if needed
  const getAnalyses = useCallback(async () => {
    if (isActiveCacheValid() && hasInitialLoad) {
      return analyses;
    }
    return await fetchAnalyses();
  }, [isActiveCacheValid, hasInitialLoad, analyses, fetchAnalyses]);

  // Get archived analyses with automatic loading if needed
  const getArchivedAnalyses = useCallback(async () => {
    if (isArchivedCacheValid() && hasArchivedInitialLoad) {
      return archivedAnalyses;
    }
    return await fetchArchivedAnalyses();
  }, [isArchivedCacheValid, hasArchivedInitialLoad, archivedAnalyses, fetchArchivedAnalyses]);

  // Clear cache (useful for logout)
  const clearCache = useCallback(() => {
    setAnalyses([]);
    setArchivedAnalyses([]);
    setLastFetchTime(null);
    setLastArchivedFetchTime(null);
    setHasInitialLoad(false);
    setHasArchivedInitialLoad(false);
    if (fetchPromiseRef.current) {
      fetchPromiseRef.current = null;
    }
    if (fetchArchivedPromiseRef.current) {
      fetchArchivedPromiseRef.current = null;
    }
  }, []);

  // Clear cache when user changes (login/logout)
  useEffect(() => {
    if (!user) {
      clearCache();
    }
  }, [user, clearCache]);

  return (
    <HistoryContext.Provider value={{
      // Active analyses
      analyses,
      loading,
      fetchAnalyses,
      addAnalysis,
      removeAnalysis,
      refreshAnalyses,
      getAnalyses,
      
      // Archived analyses
      archivedAnalyses,
      loadingArchived,
      fetchArchivedAnalyses,
      getArchivedAnalyses,
      restoreAnalysis,
      refreshArchivedAnalyses: () => fetchArchivedAnalyses(true),
      
      // Common
      clearCache,
      isCacheValid: isActiveCacheValid(),
      isArchivedCacheValid: isArchivedCacheValid(),
      hasInitialLoad,
      hasArchivedInitialLoad
    }}>
      {children}
    </HistoryContext.Provider>
  );
};
