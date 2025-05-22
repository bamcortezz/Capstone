import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from './Sidebar';

const Navbar = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  // Close dropdown when clicking outside
  const dropdownRef = React.useRef(null);
  
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const handleLogout = async () => {
    try {
      await logout();
      setIsDropdownOpen(false);
      navigate('/');
    } catch (error) {
      console.error('Navbar logout error:', error);
      setIsDropdownOpen(false);
    }
  };

  return (
    <>
      <nav className="bg-black border-b border-gray-800 py-4 px-6 fixed w-full top-0 z-30">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          {/* Left - Logo */}
          <Link to="/" className="text-white text-2xl font-bold">
            Twitch <span className="text-twitch">Insight</span>
          </Link>

          {/* Middle - Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link 
              to="/" 
              className={`transition-colors ${
                location.pathname === '/' 
                  ? 'text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Home
            </Link>
            <Link 
              to="/analyze" 
              className={`transition-colors ${
                location.pathname === '/analyze' 
                  ? 'text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Analyze
            </Link>
            {user && (
              <Link 
                to="/history" 
                className={`transition-colors ${
                  location.pathname === '/history' 
                    ? 'text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                History
              </Link>
            )}
            <Link 
              to="/contact" 
              className={`transition-colors ${
                location.pathname === '/contact' 
                  ? 'text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Contact Us
            </Link>
            <Link 
              to="/about" 
              className={`transition-colors ${
                location.pathname === '/about' 
                  ? 'text-white' 
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              About Us
            </Link>
          </div>
          
          {/* Right - Auth Buttons */}
          <div className="flex items-center space-x-4">
            {user ? (
              /* User Menu - Only shown when logged in */
              <div className="relative hidden md:block" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center space-x-2 text-gray-300 hover:text-white focus:outline-none"
                >
                  <div className="w-8 h-8 rounded-full bg-twitch flex items-center justify-center overflow-hidden">
                    {user.profile_image ? (
                      <img 
                        src={user.profile_image} 
                        alt={`${user.first_name}'s profile`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-white font-medium">
                        {user.first_name[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="hidden md:block">{user.first_name}</span>
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 transform opacity-100 scale-100 transition-all duration-200">
                    <div className="py-1">
                      <Link
                        to="/settings"
                        onClick={() => setIsDropdownOpen(false)}
                        className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Settings
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Auth Buttons - Only shown when logged out */
              <div className="hidden md:flex items-center space-x-3">
                <Link to="/login">
                  <button className="text-gray-300 hover:text-white transition-colors px-4 py-1 rounded border border-gray-600">
                    Sign In
                  </button>
                </Link>
                <Link to="/register">
                  <button className="bg-twitch hover:bg-twitch-dark text-white px-4 py-1 rounded transition-colors">
                    Sign Up
                  </button>
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button 
              className="text-gray-300 hover:text-white md:hidden"
              onClick={() => setIsSidebarOpen(true)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Sidebar */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        user={user}
        onLogout={handleLogout}
      />
      
      {/* Spacer to prevent content from going under navbar */}
      <div className="h-16"></div>
    </>
  );
};

export default Navbar;
