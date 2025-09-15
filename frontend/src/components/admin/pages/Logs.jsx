import React, { useState, useEffect } from 'react';
import { ClipLoader } from 'react-spinners';
import { useAuth } from '../../../contexts/AuthContext';
import { useAdmin } from '../../../contexts/AdminContext';

// API URL
const API_URL = import.meta.env.VITE_API_URL;

const Logs = () => {
  const { getAuthHeaders } = useAuth();
  const { loading, fetchLogs } = useAdmin();
  // State management
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  const [dataLoaded, setDataLoaded] = useState(false);

  // Handle items per page change
  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(Number(newItemsPerPage));
    setCurrentPage(1);
  };

  // Fetch logs from API using context
  const fetchLogsData = async () => {
    try {
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm,
        sortField: sortConfig.key,
        sortDirection: sortConfig.direction
      };
      
      const response = await fetchLogs(params);
      
      console.log('Fetch response:', response); // Debug log
      setLogs(response.logs || []);
      setTotalItems(response.totalItems || 0);
      setDataLoaded(true);
      
      // If we're on a page that doesn't exist, go back to page 1
      const calculatedTotalPages = Math.ceil((response.totalItems || 0) / itemsPerPage);
      console.log(`Current page: ${currentPage}, Calculated total pages: ${calculatedTotalPages}, Total items: ${response.totalItems}`); // Debug log
      if (currentPage > calculatedTotalPages && calculatedTotalPages > 0) {
        console.log(`Redirecting from page ${currentPage} to page 1 because page doesn't exist`);
        setCurrentPage(1);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      setLogs([]);
      setTotalItems(0);
      setDataLoaded(false);
      // If there's an error, reset to page 1
      setCurrentPage(1);
    }
  };

  // Handle sorting
  const handleSort = (key) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    });
  };

  // Handle search
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  // Format timestamp
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };

  // Pagination
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginate = (pageNumber) => {
    console.log(`Attempting to navigate to page ${pageNumber}, totalPages: ${totalPages}, totalItems: ${totalItems}, dataLoaded: ${dataLoaded}`); // Debug log
    
    // Don't allow navigation if data isn't loaded yet
    if (!dataLoaded) {
      console.log('Data not loaded yet, ignoring pagination');
      return;
    }
    
    // Ensure we don't navigate to invalid pages
    if (pageNumber > 0 && pageNumber <= totalPages && totalPages > 0) {
      setCurrentPage(pageNumber);
    } else if (pageNumber > totalPages && totalPages > 0) {
      // If trying to go beyond the last page, go to the last page
      console.log(`Page ${pageNumber} is beyond totalPages ${totalPages}, redirecting to last page`);
      setCurrentPage(totalPages);
    } else if (pageNumber < 1) {
      // If trying to go below page 1, go to page 1
      console.log(`Page ${pageNumber} is below 1, redirecting to page 1`);
      setCurrentPage(1);
    } else {
      console.log(`Invalid page navigation: pageNumber=${pageNumber}, totalPages=${totalPages}, totalItems=${totalItems}`);
    }
  };

  // Effect hooks
  useEffect(() => {
    // Only fetch if we have valid pagination parameters
    if (currentPage > 0 && itemsPerPage > 0) {
      fetchLogsData();
    }
  }, [currentPage, itemsPerPage, searchTerm, sortConfig, fetchLogs]);

  // Get activity style
  const getActivityStyle = (activity) => {
    if (activity.toLowerCase().includes('logged in')) {
      return 'bg-green-900 text-green-200 border border-green-700';
    } else if (activity.toLowerCase().includes('updated user profile')) {
      return 'bg-indigo-900 text-indigo-200 border border-indigo-700';
    } else if (activity.toLowerCase().includes('updated')) {
      return 'bg-blue-900 text-blue-200 border border-blue-700';
    } else if (activity.toLowerCase().includes('analysis') || activity.toLowerCase().includes('performed')) {
      return 'bg-purple-900 text-purple-200 border border-purple-700';
    } else {
      return 'bg-gray-800 text-gray-300 border border-gray-700';
    }
  };

  // Calculate starting ID number for current page
  const getStartingIdNumber = () => {
    return (currentPage - 1) * itemsPerPage + 1;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">System Logs</h1>
        <button
          onClick={fetchLogsData}
          disabled={loading.logs}
          className="flex items-center gap-2 bg-twitch hover:bg-twitch/80 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
          title="Refresh logs"
        >
          <svg 
            className={`w-4 h-4 ${loading.logs ? 'animate-spin' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth="2" 
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
            />
          </svg>
          {loading.logs ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row gap-4 md:items-center bg-gray-900 p-4 rounded-lg">
        <div className="flex-1">
          <div className="relative">
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={handleSearch}
              className="w-full bg-gray-800 text-white placeholder-gray-400 border border-gray-700 rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:border-twitch"
            />
            <svg
              className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
        <div className="flex flex-row gap-4">
          <select
            value={itemsPerPage}
            onChange={(e) => handleItemsPerPageChange(e.target.value)}
            className="bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-twitch"
          >
            <option value={5}>5 per page</option>
            <option value={10}>10 per page</option>
            <option value={15}>15 per page</option>
            <option value={20}>20 per page</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-800">
        {loading.logs ? (
          <div className="flex justify-center items-center py-20">
            <ClipLoader color="#9147ff" size={40} />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-800">
                <thead className="bg-gray-800/50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:text-white"
                      onClick={() => handleSort('id')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>ID</span>
                        {sortConfig.key === 'id' && (
                          <svg className={`w-4 h-4 ${sortConfig.direction === 'desc' ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:text-white"
                      onClick={() => handleSort('user_name')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Full Name</span>
                        {sortConfig.key === 'user_name' && (
                          <svg className={`w-4 h-4 ${sortConfig.direction === 'desc' ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:text-white"
                      onClick={() => handleSort('activity')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Activity</span>
                        {sortConfig.key === 'activity' && (
                          <svg className={`w-4 h-4 ${sortConfig.direction === 'desc' ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                    >
                      <span>Details</span>
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:text-white"
                      onClick={() => handleSort('created_at')}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Created At</span>
                        {sortConfig.key === 'created_at' && (
                          <svg className={`w-4 h-4 ${sortConfig.direction === 'desc' ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 bg-gray-900">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-4 text-center text-gray-400">
                        No logs found.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log, index) => (
                      <tr
                        key={index}
                        className="hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-white">
                            {getStartingIdNumber() + index}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-300">{log.user_name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-md ${getActivityStyle(log.activity)}`}>
                            {log.activity}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-300">{log.details || "No additional details provided"}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-300">{formatDate(log.created_at)}</div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {logs.length > 0 && (
              <div className="bg-gray-900 px-6 py-4 border-t border-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => paginate(currentPage - 1)}
                      disabled={currentPage === 1 || !dataLoaded}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-md ${currentPage === 1 || !dataLoaded
                        ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                        : 'text-white bg-twitch hover:bg-twitch/80'
                        }`}
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => paginate(currentPage + 1)}
                      disabled={currentPage === totalPages || !dataLoaded}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-md ${currentPage === totalPages || !dataLoaded
                        ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                        : 'text-white bg-twitch hover:bg-twitch/80'
                        }`}
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-400">
                        Showing <span className="font-medium text-white">
                          {Math.min(itemsPerPage, logs.length)}
                        </span> of{' '}
                        <span className="font-medium text-white">{totalItems}</span> results
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                          onClick={() => paginate(currentPage - 1)}
                          disabled={currentPage === 1 || !dataLoaded}
                          className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-700 text-sm font-medium ${currentPage === 1 || !dataLoaded
                            ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                            : 'text-gray-300 hover:bg-gray-800'
                            }`}
                        >
                          <span className="sr-only">Previous</span>
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        {totalPages > 0 && [...Array(totalPages)].map((_, index) => {
                          const pageNumber = index + 1;
                          const isCurrentPage = pageNumber === currentPage;
                          const isNearCurrentPage =
                            Math.abs(pageNumber - currentPage) <= 1 ||
                            pageNumber === 1 ||
                            pageNumber === totalPages;

                          if (!isNearCurrentPage) {
                            if (pageNumber === 2 || pageNumber === totalPages - 1) {
                              return (
                                <span
                                  key={pageNumber}
                                  className="relative inline-flex items-center px-4 py-2 border border-gray-700 bg-gray-800 text-sm font-medium text-gray-400"
                                >
                                  ...
                                </span>
                              );
                            }
                            return null;
                          }

                          return (
                            <button
                              key={pageNumber}
                              onClick={() => paginate(pageNumber)}
                              className={`relative inline-flex items-center px-4 py-2 border border-gray-700 text-sm font-medium ${isCurrentPage
                                ? 'z-10 bg-twitch text-white border-twitch'
                                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                }`}
                            >
                              {pageNumber}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => paginate(currentPage + 1)}
                          disabled={currentPage === totalPages || !dataLoaded}
                          className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-700 text-sm font-medium ${currentPage === totalPages || !dataLoaded
                            ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                            : 'text-gray-300 hover:bg-gray-800'
                            }`}
                        >
                          <span className="sr-only">Next</span>
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Logs; 