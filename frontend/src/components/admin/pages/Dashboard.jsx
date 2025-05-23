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
        <div className="bg-gray-900 p-6 rounded-lg">
          <h3 className="text-gray-400 text-sm font-medium">Total Users</h3>
          {loading ? (
            <div className="flex justify-center items-center h-8 mt-2">
              <ClipLoader color="#9147ff" size={24} />
            </div>
          ) : (
            <p className="text-2xl font-bold text-white mt-2">{userStats.total}</p>
          )}
        </div>
        <div className="bg-gray-900 p-6 rounded-lg">
          <h3 className="text-gray-400 text-sm font-medium">Active Users</h3>
          {loading ? (
            <div className="flex justify-center items-center h-8 mt-2">
              <ClipLoader color="#9147ff" size={24} />
            </div>
          ) : (
            <p className="text-2xl font-bold text-white mt-2">{userStats.active}</p>
          )}
        </div>
        <div className="bg-gray-900 p-6 rounded-lg">
          <h3 className="text-gray-400 text-sm font-medium">Total Comments</h3>
          {loading ? (
            <div className="flex justify-center items-center h-8 mt-2">
              <ClipLoader color="#9147ff" size={24} />
            </div>
          ) : (
            <p className="text-2xl font-bold text-white mt-2">{commentsStats.total.toLocaleString()}</p>
          )}
        </div>
        <div className="bg-gray-900 p-6 rounded-lg">
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

      {/* Recent Activity */}
      <div className="bg-gray-900 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {/* Activity items would go here */}
          <p className="text-gray-400">No recent activity to display.</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 