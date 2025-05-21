import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const getLinkClass = (path) => {
    return `text-gray-300 hover:text-white text-lg font-medium transition-colors ${
      location.pathname === path ? 'text-white' : ''
    }`;
  };

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100 z-40' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      
      {/* Sidebar - slides from left */}
      <div 
        className={`fixed top-0 left-0 h-full w-72 bg-black border-r border-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5">
          {/* Header Container */}
          <div className="flex items-center justify-between mb-8">
            {/* Title */}
            <h2 className="text-2xl font-bold text-white">
              Twitch <span className="text-twitch">Insight</span>
            </h2>
            
            {/* Close Button */}
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* User Info - Only shown when logged in */}
          {user && (
            <div className="mb-6 pb-6 border-b border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-twitch flex items-center justify-center">
                  <span className="text-white font-medium text-lg">
                    {user.first_name[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">{`${user.first_name} ${user.last_name}`}</p>
                  <p className="text-gray-400 text-sm">{user.email}</p>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex flex-col gap-4">
            <Link 
              to="/" 
              className={getLinkClass('/')}
              onClick={onClose}
            >
              <div className="flex items-center space-x-3">
                <span className="text-twitch">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </span>
                <span>Home</span>
              </div>
            </Link>

            <Link 
              to="/analyze" 
              className={getLinkClass('/analyze')}
              onClick={onClose}
            >
              <div className="flex items-center space-x-3">
                <span className="text-twitch">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </span>
                <span>Analyze</span>
              </div>
            </Link>

            {user && (
              <Link 
                to="/history" 
                className={getLinkClass('/history')}
                onClick={onClose}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-twitch">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                  <span>History</span>
                </div>
              </Link>
            )}

            <Link 
              to="/contact" 
              className={getLinkClass('/contact')}
              onClick={onClose}
            >
              <div className="flex items-center space-x-3">
                <span className="text-twitch">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
                <span>Contact Us</span>
              </div>
            </Link>
            
            <Link 
              to="/about" 
              className={getLinkClass('/about')}
              onClick={onClose}
            >
              <div className="flex items-center space-x-3">
                <span className="text-twitch">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                <span>About Us</span>
              </div>
            </Link>

            <div className="border-t border-gray-700 my-4" />

            {user ? (
              <>
                <Link 
                  to="/profile" 
                  className={getLinkClass('/profile')}
                  onClick={onClose}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-twitch">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </span>
                    <span>Profile</span>
                  </div>
                </Link>

                <Link 
                  to="/settings" 
                  className={getLinkClass('/settings')}
                  onClick={onClose}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-twitch">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </span>
                    <span>Settings</span>
                  </div>
                </Link>

                <button                  
                  onClick={async () => {
                    try {
                      await logout();
                      onClose();
                    } catch (error) {
                      console.error('Sidebar logout error:', error);
                      onClose();
                    }
                  }}
                  className="text-gray-300 hover:text-white text-lg font-medium transition-colors flex items-center space-x-3"
                >
                  <span className="text-twitch">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </span>
                  <span>Sign out</span>
                </button>
              </>
            ) : (
              <>
                <Link 
                  to="/login" 
                  className={getLinkClass('/login')}
                  onClick={onClose}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-twitch">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                    </span>
                    <span>Sign In</span>
                  </div>
                </Link>

                <Link 
                  to="/register" 
                  className={getLinkClass('/register')}
                  onClick={onClose}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-twitch">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                    </span>
                    <span>Sign Up</span>
                  </div>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
