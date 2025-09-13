import React, { createContext, useState, useContext, useEffect } from 'react';
import Swal from 'sweetalert2';

// API URL
const API_URL = import.meta.env.VITE_API_URL;

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Get token from localStorage
  const getToken = () => {
    return localStorage.getItem('token');
  };

  // Set token in localStorage
  const setToken = (token) => {
    localStorage.setItem('token', token);
  };

  // Remove token from localStorage
  const removeToken = () => {
    localStorage.removeItem('token');
  };

  // Get authorization headers
  const getAuthHeaders = () => {
    const token = getToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = getToken();
        if (!token) {
          setUser(null);
          setLoading(false);
          return;
        }

        const response = await fetch(`${API_URL}/api/authenticate`, {
          headers: getAuthHeaders()
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          // Token is invalid, remove it
          removeToken();
          setUser(null);
        }
      } catch (error) {
        console.error('Auth error:', error);
        removeToken();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (userData) => {
    setUser(userData);
  };
  
  const logout = async () => {
    try {
      // Clean up any global references
      if (typeof window !== 'undefined') {
        window.userSocket = null;
      }
      
      const response = await fetch(`${API_URL}/api/logout`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Logout failed');
      }

      removeToken();
      setUser(null);
      
      await Swal.fire({
        position: 'top-end',
        icon: 'success',
        title: 'Logged out successfully',
        toast: true,
        timerProgressBar: true,
        showConfirmButton: false,
        timer: 1000,
        confirmButtonColor: '#9147ff',
        background: '#18181b',
        color: '#fff'
      });
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails on server, clear local state
      removeToken();
      setUser(null);
      
      await Swal.fire({
        position: 'top-end',
        icon: 'error',
        title: 'Logout failed',
        text: error.message,
        toast: true,
        timerProgressBar: true,
        showConfirmButton: false,
        timer: 1000,
        confirmButtonColor: '#9147ff',
        background: '#18181b',
        color: '#fff'
      });
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const response = await fetch(`${API_URL}/api/user/profile`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(profileData)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to update profile');
      }

      const data = await response.json();
      setUser(data.user);
      return data;
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  };

  const updateProfileImage = async (imageData) => {
    try {
      const response = await fetch(`${API_URL}/api/user/profile-image`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ image: imageData })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to update profile image');
      }

      const data = await response.json();
      setUser(data.user);
      return data;
    } catch (error) {
      console.error('Profile image update error:', error);
      throw error;
    }
  };

  const removeProfileImage = async () => {
    try {
      const response = await fetch(`${API_URL}/api/user/profile-image`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to remove profile image');
      }

      const data = await response.json();
      setUser(data.user);
      return data;
    } catch (error) {
      console.error('Error removing profile image:', error);
      throw error;
    }
  };

  const changePassword = async (oldPassword, newPassword) => {
    try {
      const response = await fetch(`${API_URL}/api/user/change-password`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to change password');
      }
      return data;
    } catch (error) {
      console.error('Change password error:', error);
      throw error;
    }
  };

  const deleteAccount = async (password) => {
    try {
      const response = await fetch(`${API_URL}/api/user/delete-account`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ password })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to delete account');
      }
      removeToken();
      setUser(null);
      return data;
    } catch (error) {
      console.error('Delete account error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      logout,
      updateProfile,
      updateProfileImage,
      removeProfileImage,
      changePassword,
      deleteAccount,
      getToken,
      setToken,
      removeToken,
      getAuthHeaders
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext;