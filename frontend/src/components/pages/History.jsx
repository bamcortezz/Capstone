import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import Swal from 'sweetalert2';
import { ClipLoader } from 'react-spinners';

// API URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Analysis Details Modal Component
const AnalysisModal = ({ analysis, onClose }) => {
  if (!analysis) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Modal Content */}
        <div className="p-6">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2 flex items-center justify-center">
              <span className="text-twitch mr-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </span>
              {analysis.streamer_name}
            </h2>
            <p className="text-gray-400">
              Analysis from {format(new Date(analysis.created_at), 'MMMM d, yyyy HH:mm')}
            </p>
          </div>

          <div className="space-y-6">
            {/* Sentiment Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-black/50 p-4 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-green-400">Positive</span>
                  <span className="text-2xl font-bold text-green-400">
                    {analysis.sentiment_count.positive}
                  </span>
                </div>
              </div>
              <div className="bg-black/50 p-4 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-orange-400">Neutral</span>
                  <span className="text-2xl font-bold text-orange-400">
                    {analysis.sentiment_count.neutral}
                  </span>
                </div>
              </div>
              <div className="bg-black/50 p-4 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-red-400">Negative</span>
                  <span className="text-2xl font-bold text-red-400">
                    {analysis.sentiment_count.negative}
                  </span>
                </div>
              </div>
            </div>

            {/* AI Summary */}
            <div className="bg-black/50 p-6 rounded-lg border border-gray-700">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                <span className="text-twitch mr-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </span>
                AI Analysis Summary
              </h3>
              <p className="text-gray-300 whitespace-pre-line">
                {analysis.summary || "No summary available"}
              </p>
            </div>

            {/* Top Contributors */}
            <div className="bg-black/50 p-6 rounded-lg border border-gray-700">
              <h3 className="text-xl font-semibold text-white mb-4">Top Contributors</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <h4 className="font-medium text-green-400 mb-2">Top Positive</h4>
                  {analysis.top_positive.map((contributor, index) => (
                    <div key={index} className="text-sm py-1">
                      <span className="text-twitch">{contributor.username}</span>
                      <span className="text-gray-300">: {contributor.count} messages</span>
                    </div>
                  ))}
                </div>
                <div>
                  <h4 className="font-medium text-orange-400 mb-2">Top Neutral</h4>
                  {analysis.top_neutral.map((contributor, index) => (
                    <div key={index} className="text-sm py-1">
                      <span className="text-twitch">{contributor.username}</span>
                      <span className="text-gray-300">: {contributor.count} messages</span>
                    </div>
                  ))}
                </div>
                <div>
                  <h4 className="font-medium text-red-400 mb-2">Top Negative</h4>
                  {analysis.top_negative.map((contributor, index) => (
                    <div key={index} className="text-sm py-1">
                      <span className="text-twitch">{contributor.username}</span>
                      <span className="text-gray-300">: {contributor.count} messages</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const History = () => {
  const [analyses, setAnalyses] = useState([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    fetchAnalyses();
  }, []);

  const fetchAnalyses = async () => {
    try {
      const response = await fetch(`${API_URL}/api/history`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analyses');
      }

      const data = await response.json();
      setAnalyses(data);
    } catch (error) {
      console.error('Error fetching analyses:', error);
      Swal.fire({
        title: 'Error',
        text: 'Failed to load analysis history',
        icon: 'error',
        background: '#1F2937',
        color: '#fff'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (analysisId, e) => {
    e.stopPropagation();
    
    const result = await Swal.fire({
      title: 'Delete Analysis?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#10B981',
      cancelButtonColor: '#374151',
      confirmButtonText: 'Yes',
      background: '#1F2937',
      color: '#fff',
      showConfirmButton: true
    });

    if (result.isConfirmed) {
      try {
        const response = await fetch(`${API_URL}/api/history/${analysisId}`, {
          method: 'DELETE',
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Failed to delete analysis');
        }

        setAnalyses(prevAnalyses => prevAnalyses.filter(analysis => analysis._id !== analysisId));
        if (selectedAnalysis?._id === analysisId) {
          setSelectedAnalysis(null);
        }

        await Swal.fire({
          title: 'Deleted!',
          text: 'Analysis has been deleted.',
          icon: 'success',
          timer: 2000,
          timerProgressBar: true,
          showConfirmButton: false,
          position: 'top-end',
          toast: true
        });
      } catch (error) {
        console.error('Delete failed:', error);
        Swal.fire({
          title: 'Error',
          text: 'Failed to delete analysis',
          icon: 'error',
          timer: 3000,
          timerProgressBar: true,
          showConfirmButton: false,
          position: 'top-end',
          toast: true
        });
      }
    }
  };

  const handleDownloadPDF = async (analysisId, e) => {
    e.stopPropagation();
    
    // Show confirmation dialog
    const result = await Swal.fire({
      title: 'Download Analysis PDF?',
      text: "Do you want to save this analysis as PDF?",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10B981',
      cancelButtonColor: '#374151',
      confirmButtonText: 'Yes',
      background: '#1F2937',
      color: '#fff',
      showConfirmButton: true
    });

    if (result.isConfirmed) {
      try {
        const response = await fetch(`${API_URL}/api/history/${analysisId}/pdf`, {
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Failed to download PDF');
        }

        // Get the blob from the response
        const blob = await response.blob();
        
        // Create a URL for the blob
        const url = window.URL.createObjectURL(blob);
        
        // Create a temporary link element
        const link = document.createElement('a');
        link.href = url;
        link.download = `chat_analysis_${analysisId}.pdf`;
        
        // Append to body, click, and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up the URL
        window.URL.revokeObjectURL(url);

      } catch (error) {
        console.error('Download failed:', error);
        Swal.fire({
          title: 'Error',
          text: 'Failed to download PDF',
          icon: 'error',
          timer: 3000,
          timerProgressBar: true,
          showConfirmButton: false,
          position: 'top-end',
          toast: true
        });
      }
    }
  };

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = analyses.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(analyses.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex justify-center items-center">
        <ClipLoader size={36} color="#9146FF" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="relative py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center pt-10 pb-16">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
              Analysis <span className="text-twitch">History</span>
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Review your past stream analyses and track sentiment patterns over time.
            </p>
          </div>

          {analyses.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">No analysis history found.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Table Section */}
              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead className="bg-gray-900">
                    <tr>
                      <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-white w-20">
                        #
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-white">
                        Streamer
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-white">
                        Date
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-sm font-semibold text-white">
                        Messages
                      </th>
                      <th scope="col" className="px-6 py-4 text-center text-sm font-semibold text-white w-24">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700 bg-black">
                    {currentItems.map((analysis, index) => (
                      <tr 
                        key={analysis._id}
                        className="hover:bg-gray-900/50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-400">
                            {indexOfFirstItem + index + 1}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-white">
                            {analysis.streamer_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-300">
                            {format(new Date(analysis.created_at), 'MMM d, yyyy HH:mm')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-twitch">
                            {analysis.total_chats}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center justify-center space-x-3">
                            <button
                              className="text-twitch hover:text-twitch/80 transition-colors p-1 rounded-full hover:bg-twitch/10"
                              onClick={() => setSelectedAnalysis(analysis)}
                              title="View Details"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button
                              className="text-blue-500 hover:text-blue-400 transition-colors p-1 rounded-full hover:bg-blue-500/10"
                              onClick={(e) => handleDownloadPDF(analysis._id, e)}
                              title="Download PDF"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </button>
                            <button
                              className="text-red-500 hover:text-red-400 transition-colors p-1 rounded-full hover:bg-red-500/10"
                              onClick={(e) => handleDelete(analysis._id, e)}
                              title="Delete Analysis"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
              <div className="flex justify-center space-x-2 mt-6">
                <button
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    currentPage === 1
                      ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                      : 'bg-twitch text-white hover:bg-twitch/80'
                  }`}
                >
                  Previous
                </button>
                {[...Array(totalPages)].map((_, index) => (
                  <button
                    key={index + 1}
                    onClick={() => paginate(index + 1)}
                    className={`px-4 py-2 rounded-md text-sm font-medium ${
                      currentPage === index + 1
                        ? 'bg-twitch text-white'
                        : 'bg-gray-800 text-white hover:bg-gray-700'
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
                <button
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    currentPage === totalPages
                      ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                      : 'bg-twitch text-white hover:bg-twitch/80'
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Analysis Details Modal */}
      {selectedAnalysis && (
        <AnalysisModal
          analysis={selectedAnalysis}
          onClose={() => setSelectedAnalysis(null)}
        />
      )}
    </div>
  );
};

export default History;