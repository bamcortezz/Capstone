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
  const [loading, setLoading] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const fetchPromiseRef = useRef(null);

  // Cache duration: 5 minutes
  const CACHE_DURATION = 5 * 60 * 1000;

  const isCacheValid = useCallback(() => {
    if (!lastFetchTime || !hasInitialLoad) return false;
    return Date.now() - lastFetchTime < CACHE_DURATION;
  }, [lastFetchTime, hasInitialLoad]);

  const fetchAnalyses = useCallback(async (forceRefresh = false) => {
    // If we already have a fetch in progress, return that promise
    if (fetchPromiseRef.current && !forceRefresh) {
      return fetchPromiseRef.current;
    }

    // If cache is valid and we're not forcing refresh, return cached data
    // Note: We should return cached data even if it's empty (analyses.length === 0)
    if (isCacheValid() && !forceRefresh && hasInitialLoad) {
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
  }, [getAuthHeaders, isCacheValid, analyses.length, hasInitialLoad]);

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

  // Force refresh the cache (useful for manual refresh)
  const refreshAnalyses = useCallback(() => {
    return fetchAnalyses(true);
  }, [fetchAnalyses]);

  // Get analyses with automatic loading if needed
  const getAnalyses = useCallback(async () => {
    if (isCacheValid() && hasInitialLoad) {
      return analyses;
    }
    return await fetchAnalyses();
  }, [isCacheValid, hasInitialLoad, analyses, fetchAnalyses]);

  // Clear cache (useful for logout)
  const clearCache = useCallback(() => {
    setAnalyses([]);
    setLastFetchTime(null);
    setHasInitialLoad(false);
    if (fetchPromiseRef.current) {
      fetchPromiseRef.current = null;
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
      analyses,
      loading,
      fetchAnalyses,
      addAnalysis,
      removeAnalysis,
      refreshAnalyses,
      getAnalyses,
      clearCache,
      isCacheValid: isCacheValid(),
      hasInitialLoad
    }}>
      {children}
    </HistoryContext.Provider>
  );
};
