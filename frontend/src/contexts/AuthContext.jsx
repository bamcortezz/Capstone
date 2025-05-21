import React, { createContext, useState, useContext, useEffect } from 'react';
import Swal from 'sweetalert2';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/authenticate', {
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
      const response = await fetch('http://localhost:5000/api/logout', {
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
        timer: 2000
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
        timer: 3000
      });
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
