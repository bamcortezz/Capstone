import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import axios from 'axios';
import { ClipLoader } from 'react-spinners';
import Swal from 'sweetalert2';

// API URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Dashboard = () => {
  const { user } = useAuth();
  const [userStats, setUserStats] = useState({ total: 0, active: 0 });
  const [commentsStats, setCommentsStats] = useState({ total: 0 });
  const [usageStats, setUsageStats] = useState({ total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserStats = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/admin/users/count`, {
          withCredentials: true
        });
        setUserStats(response.data);
      } catch (error) {
        console.error('Error fetching user stats:', error);
        let errorMessage = 'Failed to load user statistics';
        if (error.response) {
          if (error.response.status === 401) {
            errorMessage = 'Authentication required';
          } else if (error.response.status === 403) {
            errorMessage = 'Admin privileges required';
          } else if (error.response.data && error.response.data.error) {
            errorMessage = error.response.data.error;
          }
        }
        Swal.fire({
          title: 'Error',
          text: errorMessage,
          icon: 'error',
          background: '#1F2937',
          color: '#fff'
        });
      } finally {
        setLoading(false);
      }
    };

    const fetchCommentsStats = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/admin/comments/count`, {
          withCredentials: true
        });
        setCommentsStats(response.data);
      } catch (error) {
        console.error('Error fetching comments stats:', error);
      }
    };


    const fetchUsageStats = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/admin/usage/count`, {
          withCredentials: true
        });
        setUsageStats(response.data);
      } catch (error) {
        console.error('Error fetching usage stats:', error);
      }
    };

    fetchUserStats();
    fetchCommentsStats();
    fetchUsageStats();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Stats Cards */}
        <div className="bg-gray-900 p-6 rounded-lg flex items-center gap-4">
          <span className="bg-twitch/20 p-3 rounded-full">
            <svg className="w-7 h-7 text-twitch" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </span>
          <div>
            <h3 className="text-gray-400 text-sm font-medium">Total Users</h3>
            {loading ? (
              <div className="flex justify-center items-center h-8 mt-2">
                <ClipLoader color="#9147ff" size={24} />
              </div>
            ) : (
              <p className="text-2xl font-bold text-white mt-2">{userStats.total}</p>
            )}
          </div>
        </div>
        <div className="bg-gray-900 p-6 rounded-lg flex items-center gap-4">
          <span className="bg-green-700/20 p-3 rounded-full">
            <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <div>
            <h3 className="text-gray-400 text-sm font-medium">Active Users</h3>
            {loading ? (
              <div className="flex justify-center items-center h-8 mt-2">
                <ClipLoader color="#9147ff" size={24} />
              </div>
            ) : (
              <p className="text-2xl font-bold text-white mt-2">{userStats.active}</p>
            )}
          </div>
        </div>
        <div className="bg-gray-900 p-6 rounded-lg flex items-center gap-4">
          <span className="bg-blue-700/20 p-3 rounded-full">
            <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8h2a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8a2 2 0 012-2h2m2-4h4a2 2 0 012 2v4a2 2 0 01-2 2h-4a2 2 0 01-2-2V6a2 2 0 012-2z" />
            </svg>
          </span>
          <div>
            <h3 className="text-gray-400 text-sm font-medium">Total Comments</h3>
            {loading ? (
              <div className="flex justify-center items-center h-8 mt-2">
                <ClipLoader color="#9147ff" size={24} />
              </div>
            ) : (
              <p className="text-2xl font-bold text-white mt-2">{commentsStats.total.toLocaleString()}</p>
            )}
          </div>
        </div>
        <div className="bg-gray-900 p-6 rounded-lg flex items-center gap-4">
          <span className="bg-purple-700/20 p-3 rounded-full">
            <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2a4 4 0 014-4h4m0 0V7a4 4 0 00-4-4H7a4 4 0 00-4 4v10a4 4 0 004 4h4" />
            </svg>
          </span>
          <div>
            <h3 className="text-gray-400 text-sm font-medium">Total Usage</h3>
            {loading ? (
              <div className="flex justify-center items-center h-8 mt-2">
                <ClipLoader color="#9147ff" size={24} />
              </div>
            ) : (
              <p className="text-2xl font-bold text-white mt-2">{usageStats.total.toLocaleString()}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 