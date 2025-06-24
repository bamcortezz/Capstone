import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '../../../assets/Logo.png';

const AdminNavbar = ({ onMenuClick }) => {
  return (
    <nav className="bg-black/80 backdrop-blur-md fixed w-full top-0 z-30">
      <div className="border-b border-gray-800/80 h-16 px-4">
        <div className="h-full max-w-[1600px] mx-auto flex items-center justify-between">
          {/* Left - Logo and Brand */}
          <div className="flex items-center">
            <Link to="/admin/dashboard" className="flex items-center space-x-3 text-white text-3xl font-bold tracking-tight">
              <img src={Logo} alt="Twitch Insight Logo" className="h-9 w-9 object-contain" />
              <span>
                Twitch <span className="text-twitch">Insight</span>
              </span>
            </Link>
          </div>

          {/* Right - Hamburger */}
          <button
            onClick={onMenuClick}
            className="text-gray-400 hover:text-white focus:outline-none p-2 rounded-lg hover:bg-gray-800/50 transition-colors"
            aria-label="Toggle Sidebar"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default AdminNavbar; 