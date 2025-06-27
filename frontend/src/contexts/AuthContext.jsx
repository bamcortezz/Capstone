import React, { createContext, useState, useContext, useEffect } from 'react';
import Swal from 'sweetalert2';

// API URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const response = await fetch(`${API_URL}/api/authenticate`, {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Auth error:', error);
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
      const response = await fetch(`${API_URL}/api/logout`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Logout failed');
      }

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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
        credentials: 'include'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update profile');
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: imageData }),
        credentials: 'include'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update profile image');
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
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove profile image');
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password');
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete account');
      }
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
      deleteAccount
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
