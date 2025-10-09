import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ClipLoader } from 'react-spinners';
import { useNavigate } from 'react-router-dom';
import { useHistory } from '../../contexts/HistoryContext';
import Swal from 'sweetalert2';

// Utility functions
const formatNumber = (num) => {
  if (typeof num !== 'number') return num;
  return num.toLocaleString();
};

function formatDuration(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

const ArchiveHistory = () => {
  const navigate = useNavigate();
  const { 
    archivedAnalyses, 
    loadingArchived, 
    getArchivedAnalyses, 
    restoreAnalysis: restoreAnalysisContext,
    refreshArchivedAnalyses
  } = useHistory();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRestoring, setIsRestoring] = useState(false);
  
  // Fetch archived analyses on component mount
  useEffect(() => {
    const loadArchivedAnalyses = async () => {
      try {
        await getArchivedAnalyses();
      } catch (error) {
        console.error('Error loading archived analyses:', error);
        Swal.fire({
          title: 'Error',
          text: 'Failed to load archived analyses',
          icon: 'error',
          background: '#18181b',
          color: '#fff',
          confirmButtonColor: '#9147ff'
        });
      }
    };

    loadArchivedAnalyses();
  }, [getArchivedAnalyses]);
  
  // Handle restore analysis
  const restoreAnalysis = async (id, e) => {
    e?.stopPropagation();
    if (isRestoring) return;
    
    const result = await Swal.fire({
      title: 'Restore Analysis?',
      text: 'This will move the analysis back to your active history.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#9147ff',
      cancelButtonColor: '#374151',
      confirmButtonText: 'Yes, restore it',
      cancelButtonText: 'Cancel',
      background: '#18181b',
      color: '#fff',
      reverseButtons: true,
      showConfirmButton: true
    });

    if (!result.isConfirmed) return;
    
    try {
      setIsRestoring(true);
      await restoreAnalysisContext(id);
      
      // Show success toast
      await Swal.fire({
        title: 'Restored!',
        text: 'Analysis has been restored.',
        icon: 'success',
        timer: 2000,
        timerProgressBar: true,
        showConfirmButton: false,
        position: 'top-end',
        toast: true,
        background: '#18181b',
        color: '#fff'
      });
      
      // Refresh the archived analyses list
      await getArchivedAnalyses();
      
    } catch (error) {
      console.error('Error restoring analysis:', error);
      Swal.fire({
        title: 'Error',
        text: 'Failed to restore analysis',
        icon: 'error',
        timer: 3000,
        timerProgressBar: true,
        showConfirmButton: false,
        position: 'top-end',
        toast: true,
        background: '#18181b',
        color: '#fff'
      });
    } finally {
      setIsRestoring(false);
    }
  };
  
  // Filter analyses based on search term
  const filteredAnalyses = archivedAnalyses.filter(analysis => 
    analysis.streamer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    analysis._id?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Pagination
  const totalItems = filteredAnalyses.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedAnalyses = filteredAnalyses.slice(startIndex, endIndex);
  
  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };
  
  const handleRefresh = async () => {
    try {
      await refreshArchivedAnalyses();
    } catch (error) {
      console.error('Error refreshing archives:', error);
      Swal.fire({
        title: 'Error',
        text: 'Failed to refresh archived analyses',
        icon: 'error',
        background: '#18181b',
        color: '#fff',
        confirmButtonColor: '#9147ff'
      });
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="relative py-6 px-6">
        <div className="max-w-7xl mx-auto">

          {loadingArchived ? (
            <div className="flex items-center justify-center py-16">
              <ClipLoader color="#9147ff" size={40} />
            </div>
          ) : archivedAnalyses.length === 0 ? (
            <div className="text-center py-16 bg-gray-900/50 rounded-lg border border-gray-800">
              <div className="mx-auto w-16 h-16 mb-4 text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white">No archived analyses</h3>
              <p className="mt-1 text-gray-400 mb-6">Archived analyses will appear here</p>
              <button
                onClick={() => navigate('/history')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-twitch hover:bg-twitch/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-twitch transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to History
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Search and Controls */}
              <div>
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4">
                  <div className="w-full md:w-64">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search by streamer..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-800 text-white placeholder-gray-400 border border-gray-700 rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:border-twitch"
                      />
                      <svg
                        className="absolute left-3 top-3.5 h-5 w-5 text-gray-400"
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
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleRefresh}
                      disabled={loadingArchived}
                      className="flex items-center gap-2 bg-twitch hover:bg-twitch/80 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg transition-colors"
                      title="Refresh archives"
                    >
                      <svg 
                        className={`w-4 h-4 ${loadingArchived ? 'animate-spin' : ''}`} 
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
                      {loadingArchived ? 'Refreshing...' : 'Refresh'}
                    </button>
                    <button
                      onClick={() => navigate('/history')}
                      className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-3 rounded-lg transition-colors"
                      title="Back to History"
                    >
                      <svg 
                        className="w-4 h-4 md:mr-1" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth="2" 
                          d="M10 19l-7-7m0 0l7-7m-7 7h18" 
                        />
                      </svg>
                      <span className="hidden md:inline">Back</span>
                    </button>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => handleItemsPerPageChange(e.target.value)}
                      className="w-full md:w-auto bg-gray-800 text-white border border-gray-700 rounded-lg px-6 py-3 focus:outline-none focus:border-twitch"
                    >
                      <option value={5}>5 per page</option>
                      <option value={10}>10 per page</option>
                      <option value={15}>15 per page</option>
                      <option value={20}>20 per page</option>
                    </select>
                  </div>
                </div>
                <hr className="border-gray-800 mx-4" />
              </div>

              {/* Table Section */}
              <div className="overflow-x-auto rounded-lg border border-gray-700 mx-4 md:mx-0">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead className="bg-gray-900">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-white w-16">#</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-white">Streamer</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-white">Date</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-white">Duration</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-white">Messages</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-white w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700 bg-black">
                    {paginatedAnalyses.map((analysis, index) => (
                      <tr key={analysis._id} className="hover:bg-gray-900/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {startIndex + index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">

                            <div className="ml-4">
                              <div className="text-sm font-medium text-white">
                                {analysis.streamer_name || 'Unknown Streamer'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {analysis.created_at ? format(new Date(analysis.created_at), 'MMM d, yyyy HH:mm') : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {analysis.duration ? formatDuration(analysis.duration) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-twitch">
                          {analysis.total_chats ? formatNumber(analysis.total_chats) : '0'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => restoreAnalysis(analysis._id)}
                              disabled={isRestoring}
                              className="text-green-400 hover:text-green-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Restore"
                            >
                              <svg
                                className="w-5 h-5"
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
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="bg-black px-6 py-4 border-t border-gray-800">
                <div className="flex flex-col md:flex-row items-center justify-between">
                  <p className="text-sm text-gray-400 mb-4 md:mb-0">
                    Showing <span className="font-medium text-white">{startIndex + 1}</span> to{' '}
                    <span className="font-medium text-white">
                      {Math.min(endIndex, filteredAnalyses.length)}
                    </span>{' '}
                    of <span className="font-medium text-white">{filteredAnalyses.length}</span> results
                  </p>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={`relative inline-flex items-center px-3 py-2 rounded-l-md border border-gray-700 text-sm font-medium ${
                          currentPage === 1
                            ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                            : 'text-gray-300 hover:bg-gray-800 cursor-pointer'
                        }`}
                      >
                        <span className="sr-only">Previous</span>
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      {[...Array(totalPages)].map((_, index) => {
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
                                className="relative inline-flex items-center px-3 py-2 border border-gray-700 bg-gray-800 text-sm font-medium text-gray-400"
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
                            onClick={() => handlePageChange(pageNumber)}
                            className={`relative inline-flex items-center px-4 py-2 border border-gray-700 text-sm font-medium cursor-pointer ${
                              isCurrentPage
                                ? 'z-10 bg-twitch text-white border-twitch'
                                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                            }`}
                          >
                            {pageNumber}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className={`relative inline-flex items-center px-3 py-2 rounded-r-md border border-gray-700 text-sm font-medium ${
                          currentPage === totalPages
                            ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                            : 'text-gray-300 hover:bg-gray-800 cursor-pointer'
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
        </div>
      </div>
    </div>
  );
};

export default ArchiveHistory;
