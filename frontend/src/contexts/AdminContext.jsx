import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from './AuthContext';
import axios from 'axios';
import Swal from 'sweetalert2';

// API URL
const API_URL = import.meta.env.VITE_API_URL;

const AdminContext = createContext();

export const useAdmin = () => useContext(AdminContext);

export const AdminProvider = ({ children }) => {
  const { getAuthHeaders, user } = useAuth();
  const [userStats, setUserStats] = useState({ total: 0, active: 0 });
  const [commentsStats, setCommentsStats] = useState({ total: 0 });
  const [usageStats, setUsageStats] = useState({ total: 0 });
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  
  // Loading states
  const [loading, setLoading] = useState({
    userStats: false,
    commentsStats: false,
    usageStats: false,
    users: false,
    logs: false
  });
  
  // Cache timestamps
  const [lastFetchTime, setLastFetchTime] = useState({
    userStats: null,
    commentsStats: null,
    usageStats: null,
    users: null,
    logs: null
  });
  
  const [hasInitialLoad, setHasInitialLoad] = useState({
    userStats: false,
    commentsStats: false,
    usageStats: false,
    users: false,
    logs: false
  });
  
  const fetchPromiseRef = useRef({});
  
  // Cache duration: 2 minutes for admin data (more frequent updates needed)
  const CACHE_DURATION = 2 * 60 * 1000;

  const isCacheValid = useCallback((dataType) => {
    const lastTime = lastFetchTime[dataType];
    const hasLoaded = hasInitialLoad[dataType];
    if (!lastTime || !hasLoaded) return false;
    return Date.now() - lastTime < CACHE_DURATION;
  }, [lastFetchTime, hasInitialLoad]);

  // Fetch user statistics
  const fetchUserStats = useCallback(async (forceRefresh = false) => {
    const dataType = 'userStats';
    
    if (fetchPromiseRef.current[dataType] && !forceRefresh) {
      return fetchPromiseRef.current[dataType];
    }

    if (isCacheValid(dataType) && !forceRefresh && userStats.total > 0) {
      return userStats;
    }

    const fetchPromise = (async () => {
      try {
        setLoading(prev => ({ ...prev, [dataType]: true }));
        const response = await axios.get(`${API_URL}/api/admin/users/count`, {
          headers: getAuthHeaders()
        });
        
        setUserStats(response.data);
        setLastFetchTime(prev => ({ ...prev, [dataType]: Date.now() }));
        setHasInitialLoad(prev => ({ ...prev, [dataType]: true }));
        return response.data;
      } catch (error) {
        console.error('Error fetching user stats:', error);
        if (!hasInitialLoad[dataType] || forceRefresh) {
          let errorMessage = 'Failed to load user statistics';
          if (error.response?.status === 401) {
            errorMessage = 'Authentication required';
          } else if (error.response?.status === 403) {
            errorMessage = 'Admin privileges required';
          } else if (error.response?.data?.error) {
            errorMessage = error.response.data.error;
          }
          Swal.fire({
            title: 'Error',
            text: errorMessage,
            icon: 'error',
            background: '#18181b',
            color: '#fff',
            confirmButtonColor: '#9147ff'
          });
        }
        throw error;
      } finally {
        setLoading(prev => ({ ...prev, [dataType]: false }));
        fetchPromiseRef.current[dataType] = null;
      }
    })();

    fetchPromiseRef.current[dataType] = fetchPromise;
    return fetchPromise;
  }, [getAuthHeaders, isCacheValid, userStats, hasInitialLoad]);

  // Fetch comments statistics
  const fetchCommentsStats = useCallback(async (forceRefresh = false) => {
    const dataType = 'commentsStats';
    
    if (fetchPromiseRef.current[dataType] && !forceRefresh) {
      return fetchPromiseRef.current[dataType];
    }

    if (isCacheValid(dataType) && !forceRefresh && commentsStats.total > 0) {
      return commentsStats;
    }

    const fetchPromise = (async () => {
      try {
        setLoading(prev => ({ ...prev, [dataType]: true }));
        const response = await axios.get(`${API_URL}/api/admin/comments/count`, {
          headers: getAuthHeaders()
        });
        
        setCommentsStats(response.data);
        setLastFetchTime(prev => ({ ...prev, [dataType]: Date.now() }));
        setHasInitialLoad(prev => ({ ...prev, [dataType]: true }));
        return response.data;
      } catch (error) {
        console.error('Error fetching comments stats:', error);
        if (!hasInitialLoad[dataType] || forceRefresh) {
          Swal.fire({
            title: 'Error',
            text: 'Failed to load comments statistics',
            icon: 'error',
            background: '#18181b',
            color: '#fff',
            confirmButtonColor: '#9147ff'
          });
        }
        throw error;
      } finally {
        setLoading(prev => ({ ...prev, [dataType]: false }));
        fetchPromiseRef.current[dataType] = null;
      }
    })();

    fetchPromiseRef.current[dataType] = fetchPromise;
    return fetchPromise;
  }, [getAuthHeaders, isCacheValid, commentsStats, hasInitialLoad]);

  // Fetch usage statistics
  const fetchUsageStats = useCallback(async (forceRefresh = false) => {
    const dataType = 'usageStats';
    
    if (fetchPromiseRef.current[dataType] && !forceRefresh) {
      return fetchPromiseRef.current[dataType];
    }

    if (isCacheValid(dataType) && !forceRefresh && usageStats.total > 0) {
      return usageStats;
    }

    const fetchPromise = (async () => {
      try {
        setLoading(prev => ({ ...prev, [dataType]: true }));
        const response = await axios.get(`${API_URL}/api/admin/usage/count`, {
          headers: getAuthHeaders()
        });
        
        setUsageStats(response.data);
        setLastFetchTime(prev => ({ ...prev, [dataType]: Date.now() }));
        setHasInitialLoad(prev => ({ ...prev, [dataType]: true }));
        return response.data;
      } catch (error) {
        console.error('Error fetching usage stats:', error);
        if (!hasInitialLoad[dataType] || forceRefresh) {
          Swal.fire({
            title: 'Error',
            text: 'Failed to load usage statistics',
            icon: 'error',
            background: '#18181b',
            color: '#fff',
            confirmButtonColor: '#9147ff'
          });
        }
        throw error;
      } finally {
        setLoading(prev => ({ ...prev, [dataType]: false }));
        fetchPromiseRef.current[dataType] = null;
      }
    })();

    fetchPromiseRef.current[dataType] = fetchPromise;
    return fetchPromise;
  }, [getAuthHeaders, isCacheValid, usageStats, hasInitialLoad]);

  // Fetch users list
  const fetchUsers = useCallback(async (forceRefresh = false) => {
    const dataType = 'users';
    
    if (fetchPromiseRef.current[dataType] && !forceRefresh) {
      return fetchPromiseRef.current[dataType];
    }

    if (isCacheValid(dataType) && !forceRefresh && users.length > 0) {
      return users;
    }

    const fetchPromise = (async () => {
      try {
        setLoading(prev => ({ ...prev, [dataType]: true }));
        const response = await axios.get(`${API_URL}/api/admin/users`, {
          headers: getAuthHeaders()
        });
        
        setUsers(response.data);
        setLastFetchTime(prev => ({ ...prev, [dataType]: Date.now() }));
        setHasInitialLoad(prev => ({ ...prev, [dataType]: true }));
        return response.data;
      } catch (error) {
        console.error('Error fetching users:', error);
        if (!hasInitialLoad[dataType] || forceRefresh) {
          Swal.fire({
            title: 'Error',
            text: 'Failed to load users',
            icon: 'error',
            background: '#18181b',
            color: '#fff',
            confirmButtonColor: '#9147ff'
          });
        }
        throw error;
      } finally {
        setLoading(prev => ({ ...prev, [dataType]: false }));
        fetchPromiseRef.current[dataType] = null;
      }
    })();

    fetchPromiseRef.current[dataType] = fetchPromise;
    return fetchPromise;
  }, [getAuthHeaders, isCacheValid, users, hasInitialLoad]);

  // Fetch logs with pagination and smart caching
  const fetchLogs = useCallback(async (params = {}) => {
    const dataType = 'logs';
    const cacheKey = `${dataType}_${JSON.stringify(params)}`;
    
    // Check if we have this exact query cached
    if (fetchPromiseRef.current[cacheKey]) {
      return fetchPromiseRef.current[cacheKey];
    }

    const fetchPromise = (async () => {
      try {
        setLoading(prev => ({ ...prev, [dataType]: true }));
        const response = await axios.get(`${API_URL}/api/admin/logs`, {
          params,
          headers: getAuthHeaders()
        });
        
        // Cache the response for this specific query
        // We'll store it temporarily in a cache object
        if (!window.logsCache) {
          window.logsCache = {};
        }
        window.logsCache[cacheKey] = {
          data: response.data,
          timestamp: Date.now()
        };
        
        // Clean up old cache entries (older than 1 minute)
        const oneMinuteAgo = Date.now() - 60000;
        Object.keys(window.logsCache).forEach(key => {
          if (window.logsCache[key].timestamp < oneMinuteAgo) {
            delete window.logsCache[key];
          }
        });
        
        return response.data;
      } catch (error) {
        console.error('Error fetching logs:', error);
        Swal.fire({
          title: 'Error',
          text: 'Failed to load logs',
          icon: 'error',
          background: '#18181b',
          color: '#fff',
          confirmButtonColor: '#9147ff'
        });
        throw error;
      } finally {
        setLoading(prev => ({ ...prev, [dataType]: false }));
        fetchPromiseRef.current[cacheKey] = null;
      }
    })();

    fetchPromiseRef.current[cacheKey] = fetchPromise;
    return fetchPromise;
  }, [getAuthHeaders]);

  // Update user in cache
  const updateUserInCache = useCallback((updatedUser) => {
    setUsers(prev => prev.map(user => 
      user._id === updatedUser._id ? updatedUser : user
    ));
    setLastFetchTime(prev => ({ ...prev, users: Date.now() }));
  }, []);

  // Remove user from cache
  const removeUserFromCache = useCallback((userId) => {
    setUsers(prev => prev.filter(user => user._id !== userId));
    setLastFetchTime(prev => ({ ...prev, users: Date.now() }));
  }, []);

  // Force refresh all data
  const refreshAllData = useCallback(async () => {
    const promises = [
      fetchUserStats(true),
      fetchCommentsStats(true),
      fetchUsageStats(true),
      fetchUsers(true)
    ];
    
    try {
      await Promise.all(promises);
    } catch (error) {
      console.error('Error refreshing admin data:', error);
    }
  }, [fetchUserStats, fetchCommentsStats, fetchUsageStats, fetchUsers]);

  // Clear all cache
  const clearCache = useCallback(() => {
    setUserStats({ total: 0, active: 0 });
    setCommentsStats({ total: 0 });
    setUsageStats({ total: 0 });
    setUsers([]);
    setLogs([]);
    setLastFetchTime({
      userStats: null,
      commentsStats: null,
      usageStats: null,
      users: null,
      logs: null
    });
    setHasInitialLoad({
      userStats: false,
      commentsStats: false,
      usageStats: false,
      users: false,
      logs: false
    });
    fetchPromiseRef.current = {};
  }, []);

  // Clear cache when user changes (login/logout)
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      clearCache();
    }
  }, [user, clearCache]);

  return (
    <AdminContext.Provider value={{
      // Data
      userStats,
      commentsStats,
      usageStats,
      users,
      logs,
      
      // Loading states
      loading,
      
      // Fetch functions
      fetchUserStats,
      fetchCommentsStats,
      fetchUsageStats,
      fetchUsers,
      fetchLogs,
      
      // Cache management
      updateUserInCache,
      removeUserFromCache,
      refreshAllData,
      clearCache,
      
      // Cache status
      isCacheValid,
      hasInitialLoad
    }}>
      {children}
    </AdminContext.Provider>
  );
};
