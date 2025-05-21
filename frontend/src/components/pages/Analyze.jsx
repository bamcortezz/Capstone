import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import Swal from 'sweetalert2';
import { useAuth } from '../../contexts/AuthContext';

ChartJS.register(ArcElement, Tooltip, Legend);

const Analyze = () => {
  const { user } = useAuth();
  const [streamUrl, setStreamUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [sentimentCounts, setSentimentCounts] = useState({
    positive: 0,
    neutral: 0,
    negative: 0
  });
  const [userSentiments, setUserSentiments] = useState({
    positive: {},
    neutral: {},
    negative: {}
  });
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const chatContainerRef = useRef(null);

  // Scroll to bottom whenever messages update
  useEffect(() => {
    if (autoScroll && chatContainerRef.current) {
      const chatDiv = chatContainerRef.current;
      chatDiv.scrollTop = chatDiv.scrollHeight;
    }
  }, [messages, autoScroll]);

  // Handle chat container scroll
  const handleChatScroll = (e) => {
    const { scrollHeight, scrollTop, clientHeight } = e.target;
    const bottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 100;
    setShowScrollButton(!bottom);
    setAutoScroll(bottom);
  };

  // Scroll to bottom function
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      setAutoScroll(true);
      setShowScrollButton(false);
    }
  };

  // Connect to WebSocket server
  useEffect(() => {
    socketRef.current = io('http://localhost:5000');

    socketRef.current.on('connect', () => {
      console.log('Connected to WebSocket server');
    });

    socketRef.current.on('chat_message', (data) => {
      setMessages((prev) => [...prev, data]);
      // Update sentiment counts
      setSentimentCounts((prev) => ({
        ...prev,
        [data.sentiment]: prev[data.sentiment] + 1
      }));
      // Update user sentiments
      setUserSentiments((prev) => {
        const newCounts = { ...prev };
        if (!newCounts[data.sentiment][data.username]) {
          newCounts[data.sentiment][data.username] = 0;
        }
        newCounts[data.sentiment][data.username]++;
        return newCounts;
      });
    });

    socketRef.current.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
      setIsConnected(false);
      setCurrentChannel(null);
      setMessages([]);
    });

    socketRef.current.on('disconnect_notification', (data) => {
      if (data.channel === currentChannel) {
        setIsConnected(false);
        setCurrentChannel(null);
        setMessages([]);
        setStreamUrl('');
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const saveAnalysis = async () => {
    try {
      // Get top contributors for each sentiment
      const getTopContributors = (sentimentType, limit = 5) => {
        const contributors = Object.entries(userSentiments[sentimentType])
          .map(([username, count]) => ({ username, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, limit);
        return contributors;
      };

      const analysisData = {
        streamer_name: currentChannel,
        total_chats: messages.length,
        sentiment_count: sentimentCounts,
        top_positive: getTopContributors('positive'),
        top_negative: getTopContributors('negative'),
        top_neutral: getTopContributors('neutral')
      };

      const response = await fetch('http://localhost:5000/api/history/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(analysisData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save analysis');
      }

      await Swal.fire({
        title: 'Saved!',
        text: 'Analysis has been saved successfully',
        icon: 'success',
        timer: 2000,
        timerProgressBar: true,
        showConfirmButton: false,
        position: 'top-end',
        toast: true
      });

      return true;
    } catch (error) {
      console.error('Save failed:', error);

      // Show detailed error message
      let errorMessage = 'Failed to save analysis data';
      if (error.message) {
        errorMessage += `: ${error.message}`;
      }

      await Swal.fire({
        title: 'Error',
        text: errorMessage,
        icon: 'error',
        showConfirmButton: true,
        confirmButtonColor: '#EF4444'
      });
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsAnalyzing(true);
    setError('');

    try {
      if (isConnected) {
        // Show different SweetAlert options based on user session
        const alertOptions = user ? {
          title: 'Disconnect from Analysis?',
          text: 'What would you like to do with the current analysis?',
          icon: 'warning',
          showDenyButton: true,
          showCancelButton: true,
          confirmButtonText: 'Save',
          denyButtonText: 'Discard',
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#10B981', // Green for save
          denyButtonColor: '#EF4444',    // Red for discard
          cancelButtonColor: '#6B7280'    // Gray for cancel
        } : {
          title: 'Disconnect from Analysis?',
          text: 'Are you sure you want to disconnect?',
          icon: 'warning',
          showDenyButton: true,
          showCancelButton: true,
          showConfirmButton: false,
          denyButtonText: 'Disconnect',
          cancelButtonText: 'Cancel',
          denyButtonColor: '#EF4444',    // Red for disconnect
          cancelButtonColor: '#6B7280'    // Gray for cancel
        };

        const result = await Swal.fire(alertOptions);

        if (result.isConfirmed && user) {
          // Save the analysis (only possible if user is logged in)
          const saved = await saveAnalysis();
          if (saved) {
            await disconnectFromChannel();
          }
        } else if (result.isDenied) {
          // Just disconnect
          await disconnectFromChannel();
          await Swal.fire({
            title: user ? 'Discarded!' : 'Disconnected!',
            text: user ? 'Analysis has been discarded' : 'Disconnected from channel',
            icon: 'info',
            timer: 2000,
            timerProgressBar: true,
            showConfirmButton: false,
            position: 'top-end',
            toast: true
          });
        }
        // If cancelled, do nothing
      } else {
        // Connect to new channel
        const response = await fetch('http://localhost:5000/api/twitch/connect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: streamUrl }),
        });

        if (!response.ok) {
          throw new Error('Failed to connect to channel');
        }

        const data = await response.json();
        setIsConnected(true);
        setCurrentChannel(data.channel);
      }
    } catch (error) {
      console.error('Action failed:', error);
      setError(error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Helper function to handle channel disconnection
  const disconnectFromChannel = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/twitch/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channel: currentChannel }),
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      // Clean up the local state
      setIsConnected(false);
      setCurrentChannel(null);
      setMessages([]);
      setStreamUrl('');
    } catch (error) {
      console.error('Disconnect failed:', error);
      // Still clean up the local state even if the server request fails
      setIsConnected(false);
      setCurrentChannel(null);
      setMessages([]);
      setStreamUrl('');
    }
  };

  // Pie chart data
  const chartData = {
    labels: ['Positive', 'Neutral', 'Negative'],
    datasets: [
      {
        data: [sentimentCounts.positive, sentimentCounts.neutral, sentimentCounts.negative],
        backgroundColor: ['#10B981', '#F97316', '#EF4444'],
        borderColor: ['#064E3B', '#9A3412', '#991B1B'],
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#D1D5DB',
          font: {
            size: 12
          }
        }
      }
    },
    maintainAspectRatio: false
  };

  // Get top user for each sentiment
  const getTopUser = (sentiment) => {
    return Object.entries(userSentiments[sentiment])
      .sort(([, a], [, b]) => b - a)
    [0] || ['-', 0];
  };

  return (
    <div className="min-h-screen bg-black py-6 px-8">
      {/* Main container */}
      <div className="max-w-[1400px] mx-auto space-y-6">
        
        {!isConnected && (
          <div className="text-center pt-10 pb-16">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
              Start <span className="text-twitch">Analyzing</span>
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Connect to a Twitch channel to begin real-time sentiment analysis.
            </p>
          </div>
        )}

        {/* Top Container - Connect to Channel */}
        <div className="bg-black border border-gray-700 rounded-lg p-6 shadow-lg">
          <h2 className="text-2xl font-bold text-white mb-4">Connect to Channel</h2>
          <p className="text-gray-300 mb-4">Enter a Twitch channel URL to start analyzing chat</p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="streamUrl" className="block text-base font-medium text-gray-300 mb-2">
                Twitch Channel URL
              </label>
              <input
                type="url"
                id="streamUrl"
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                placeholder="https://twitch.tv/channelname"
                required={!isConnected}
                disabled={isConnected}
                className="w-full px-4 py-3 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-twitch disabled:opacity-50"
              />
              <p className="text-sm text-gray-400 mt-1">Format: https://www.twitch.tv/channelname</p>
            </div>
            
            <button
              type="submit"
              disabled={isAnalyzing}
              className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center ${
                isAnalyzing
                  ? 'bg-gray-600 cursor-not-allowed'
                  : isConnected
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-twitch hover:bg-twitch-dark text-white'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{isConnected ? 'Disconnecting...' : 'Connecting...'}</span>
                </>
              ) : (
                isConnected ? 'Disconnect' : 'Connect and Analyze'
              )}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-900/30 border border-red-600 rounded-lg">
              <p className="text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Bottom Container - Analysis and Chat */}
        {isConnected && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Side - Analysis Panels (35%) */}
            <div className="lg:col-span-4 space-y-6">
              {/* Overall Sentiment Analysis */}
              <div className="bg-black border border-gray-700 rounded-lg p-6 shadow-lg">
                <h2 className="text-xl font-bold text-white mb-3">Overall Sentiment Analysis</h2>
                <p className="text-sm text-gray-400 mb-4">Real-time sentiment breakdown of chat messages</p>
                
                {isConnected && messages.length > 0 ? (
                  <div className="h-[250px] relative">
                    <Pie data={chartData} options={chartOptions} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <svg className="w-12 h-12 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="text-gray-400 mb-1">No sentiment data available</p>
                    <p className="text-gray-500 text-sm">Connect to a channel to see analytics</p>
                  </div>
                )}
              </div>

              {/* Top Chatters Analysis */}
              <div className="bg-black border border-gray-700 rounded-lg p-6 shadow-lg">
                <h2 className="text-xl font-bold text-white mb-3">Top Chatters Analysis</h2>
                <p className="text-sm text-gray-400 mb-4">Users with most messages by sentiment</p>
                
                {isConnected && messages.length > 0 ? (
                  <div className="space-y-4">
                    {/* Positive */}
                    <div>
                      <h3 className="text-green-400 font-medium mb-2">Most Positive</h3>
                      {(() => {
                        const [username, count] = getTopUser('positive');
                        return (
                          <div className="flex justify-between items-center bg-gray-900 border border-gray-700 p-3 rounded">
                            <span className="text-gray-300">{username}</span>
                            <span className="text-green-400 font-medium">{count} messages</span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Neutral */}
                    <div>
                      <h3 className="text-orange-400 font-medium mb-2">Most Neutral</h3>
                      {(() => {
                        const [username, count] = getTopUser('neutral');
                        return (
                          <div className="flex justify-between items-center bg-gray-900 border border-gray-700 p-3 rounded">
                            <span className="text-gray-300">{username}</span>
                            <span className="text-orange-400 font-medium">{count} messages</span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Negative */}
                    <div>
                      <h3 className="text-red-400 font-medium mb-2">Most Negative</h3>
                      {(() => {
                        const [username, count] = getTopUser('negative');
                        return (
                          <div className="flex justify-between items-center bg-gray-900 border border-gray-700 p-3 rounded">
                            <span className="text-gray-300">{username}</span>
                            <span className="text-red-400 font-medium">{count} messages</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <svg className="w-12 h-12 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-gray-400 mb-1">No user data available</p>
                    <p className="text-gray-500 text-sm">Connect to a channel to see analytics</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Side - Chat Container (65%) */}
            <div className="lg:col-span-8">
              <div className="bg-black border border-gray-700 rounded-lg p-6 shadow-lg h-full min-h-[600px] relative">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                  <span className="text-twitch mr-2">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </span>
                  Chat
                  {currentChannel && <span className="ml-2 text-sm text-twitch font-normal">{currentChannel}</span>}
                </h2>
                
                {isConnected && messages.length > 0 ? (
                  <div className="h-[600px]">
                    <div
                      ref={chatContainerRef}
                      className="h-full overflow-y-auto overflow-x-hidden pr-2 space-y-3 custom-scrollbar"
                      onScroll={handleChatScroll}
                    >
                      {messages.map((msg, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-gray-900/40 border border-gray-800 p-3 rounded-lg">
                          <div className="flex items-start space-x-2 flex-1 min-w-0">
                            <span className="text-twitch font-medium whitespace-nowrap">{msg.username}:</span>
                            <span className="text-gray-300 break-words overflow-hidden">{msg.message}</span>
                          </div>
                          <span className={`ml-4 px-2 py-1 rounded text-xs font-medium whitespace-nowrap flex-shrink-0 ${
                            msg.sentiment === 'positive' ? 'bg-green-900/50 text-green-400' :
                            msg.sentiment === 'negative' ? 'bg-red-900/50 text-red-400' :
                            'bg-orange-900/50 text-orange-400'
                          }`}>
                            {msg.sentiment}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-[600px] flex items-center justify-center">
                    <div className="text-center">
                      <svg className="w-16 h-16 text-gray-600 mb-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <h3 className="text-xl text-gray-400 font-medium mb-2">No Active Chat</h3>
                      <p className="text-gray-500">Connect to a Twitch channel to start viewing</p>
                    </div>
                  </div>
                )}
                
                {showScrollButton && (
                  <button
                    onClick={scrollToBottom}
                    className="absolute bottom-6 right-6 bg-twitch hover:bg-twitch-dark text-white rounded-full p-3 shadow-lg transition-all duration-200 hover:scale-105 z-10"
                    title="Scroll to Bottom"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Analyze;
