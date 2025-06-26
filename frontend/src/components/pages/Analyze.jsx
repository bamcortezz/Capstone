import React, { useState, useEffect, useRef, useMemo } from 'react';
import io from 'socket.io-client';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import Swal from 'sweetalert2';
import { useAuth } from '../../contexts/AuthContext';
import { useAnalyze } from '../../contexts/AnalyzeContext';
import { FixedSizeList as List } from 'react-window';

// API URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Helper function to format numbers with commas
const formatNumber = (num) => {
  if (typeof num !== 'number') return num;
  return num.toLocaleString();
};

ChartJS.register(ArcElement, Tooltip, Legend);

// Memoized Pie Chart Component
const SentimentPieChart = React.memo(({ sentimentCounts }) => {
  const chartData = useMemo(() => ({
    labels: ['Positive', 'Neutral', 'Negative'],
    datasets: [
      {
        data: [sentimentCounts.positive, sentimentCounts.neutral, sentimentCounts.negative],
        backgroundColor: ['#22c55e', '#6B7280', '#ef4444'],
        borderColor: ['#16a34a', '#374151', '#b91c1c'],
        borderWidth: 1,
      },
    ],
  }), [sentimentCounts]);

  const chartOptions = useMemo(() => ({
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#D1D5DB',
          font: { size: 12 }
        }
      }
    },
    maintainAspectRatio: false
  }), []);

  return <Pie data={chartData} options={chartOptions} />;
});

// Row renderer for react-window
const ChatRow = ({ index, style, data }) => {
  const msg = data[index];
  return (
    <div
      style={style}
      key={msg.id}
      className={`flex items-center justify-between p-3 rounded-lg border-b border-gray-700 mb-2 bg-black`}
    >
      <div className="flex items-start space-x-2 flex-1 min-w-0">
        <span className="text-twitch font-medium whitespace-nowrap">{msg.username}:</span>
        <span
          className="text-white break-words overflow-hidden max-w-[60%] line-clamp-2"
          title={msg.message}
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {msg.message}
        </span>
      </div>
      <span
        className={`ml-4 px-2 py-1 rounded text-xs font-medium whitespace-nowrap flex-shrink-0 ${
          msg.sentiment === 'positive'
            ? 'bg-green-700 text-green-200'
            : msg.sentiment === 'negative'
            ? 'bg-red-700 text-red-200'
            : 'bg-gray-700 text-gray-200'
        }`}
      >
        {msg.sentiment}
      </span>
    </div>
  );
};

const Analyze = () => {
  const { user } = useAuth();
  const {
    isConnected,
    currentChannel,
    messages,
    sentimentCounts,
    userSentiments,
    connectToChannel,
    disconnectFromChannel,
    topUsers,
    getFilteredMessages,
  } = useAnalyze();
  const [streamUrl, setStreamUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const chatContainerRef = useRef(null);

  // Scroll to bottom whenever messages update
  useEffect(() => {
    if (autoScroll && chatContainerRef.current) {
      // react-window List API: scrollToItem
      chatContainerRef.current.scrollToItem(
        messages.length - 1,
        'end'
      );
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
      chatContainerRef.current.scrollToItem(
        messages.length - 1,
        'end'
      );
      setAutoScroll(true);
      setShowScrollButton(false);
    }
  };

  // Save analysis logic (remains local, but uses context state)
  const saveAnalysis = async () => {
    try {
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
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/history/save`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        credentials: 'include', 
        body: JSON.stringify(analysisData)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save analysis');
      }
      await Swal.fire({
        title: 'Saved!',
        text: 'Analysis has been saved successfully',
        icon: 'success',
        timer: 1000,
        timerProgressBar: true,
        showConfirmButton: false,
        position: 'top-end',
        toast: true,
        confirmButtonColor: '#9147ff',
        background: '#18181b',
        color: '#fff'
      });
      return true;
    } catch (error) {
      console.error('Save failed:', error);
      let errorMessage = 'Failed to save analysis data';
      if (error.message) {
        errorMessage += `: ${error.message}`;
      }
      await Swal.fire({
        title: 'Error',
        text: errorMessage,
        icon: 'error',
        showConfirmButton: true,
        confirmButtonColor: '#EF4444',
        background: '#18181b',
        color: '#fff'
      });
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsAnalyzing(true);
    try {
      if (isConnected) {
        const alertOptions = user ? {
          title: 'Disconnect from Analysis?',
          text: 'What would you like to do with the current analysis?',
          icon: 'warning',
          showDenyButton: true,
          showCancelButton: true,
          confirmButtonText: 'Save',
          denyButtonText: 'Discard',
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#9147ff',
          denyButtonColor: '#EF4444',
          cancelButtonColor: '#6B7280',
          background: '#18181b',
          color: '#fff'
        } : {
          title: 'Disconnect from Analysis?',
          text: 'Are you sure you want to disconnect?',
          icon: 'warning',
          showDenyButton: true,
          showCancelButton: true,
          showConfirmButton: false,
          denyButtonText: 'Disconnect',
          cancelButtonText: 'Cancel',
          denyButtonColor: '#EF4444',
          cancelButtonColor: '#6B7280',
          background: '#18181b',
          color: '#fff'
        };
        const result = await Swal.fire(alertOptions);
        if (result.isConfirmed && user) {
          const saved = await saveAnalysis();
          if (saved) {
            await disconnectFromChannel();
          }
        } else if (result.isDenied) {
          await disconnectFromChannel();
          await Swal.fire({
            title: user ? 'Discarded!' : 'Disconnected!',
            text: user ? 'Analysis has been discarded' : 'Disconnected from channel',
            icon: 'info',
            timer: 1000,
            timerProgressBar: true,
            showConfirmButton: false,
            position: 'top-end',
            toast: true,
            confirmButtonColor: '#9147ff',
            background: '#18181b',
            color: '#fff'
          });
        }
      } else {
        await connectToChannel(streamUrl);
      }
    } catch (error) {
      console.error('Action failed:', error);
      Swal.fire({
        title: 'Invalid Link',
        text: error.message || 'Failed to connect to channel',
        icon: 'error',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1000,
        timerProgressBar: true,
        background: '#18181b',
        color: '#fff'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Memoize filtered messages using context method
  const filteredMessages = useMemo(() => getFilteredMessages(selectedFilter), [getFilteredMessages, selectedFilter]);

  // Disconnect from channel on logout
  useEffect(() => {
    if (user === null && isConnected) {
      disconnectFromChannel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isConnected, disconnectFromChannel]);

  return (
    <div className="min-h-screen bg-black py-6 px-8">
      {/* Main container */}
      <div className="max-w-[1400px] mx-auto space-y-6">

        {!isConnected && (
          <div className="text-center pt-6 pb-12">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-4">
              Start <span className="text-twitch">Analyzing</span>
            </h1>
            <p className="text-xl text-gray-300 mb-6 max-w-3xl mx-auto">
              Connect to a Twitch channel to begin real-time sentiment analysis.
            </p>
          </div>
        )}

        {/* Top Container - Connect to Channel */}
        <div className="bg-black border border-gray-700 rounded-lg p-4 shadow-lg">
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
              className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center ${isAnalyzing
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
                    <SentimentPieChart sentimentCounts={sentimentCounts} />
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
                  <div className="space-y-3">
                    {/* Positive */}
                    {(() => {
                      const [username, count] = topUsers['positive'];
                      return (
                        <div className="flex justify-between items-center bg-black border border-gray-700/30 p-3 rounded">
                          <span className="text-twitch">{username}</span>
                          <span className="text-green-400 font-medium">{formatNumber(count)} {count === 1 ? 'message' : 'messages'}</span>
                        </div>
                      );
                    })()}

                    {/* Neutral */}
                    {(() => {
                      const [username, count] = topUsers['neutral'];
                      return (
                        <div className="flex justify-between items-center bg-black border border-gray-700/30 p-3 rounded">
                          <span className="text-twitch">{username}</span>
                          <span className="text-gray-400 font-medium">{formatNumber(count)} {count === 1 ? 'message' : 'messages'}</span>
                        </div>
                      );
                    })()}

                    {/* Negative */}
                    {(() => {
                      const [username, count] = topUsers['negative'];
                      return (
                        <div className="flex justify-between items-center bg-black border border-gray-700/30 p-3 rounded">
                          <span className="text-twitch">{username}</span>
                          <span className="text-red-400 font-medium">{formatNumber(count)} {count === 1 ? 'message' : 'messages'}</span>
                        </div>
                      );
                    })()}
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
                <div className="flex justify-between items-center mb-4">
                  <div className="flex bg-gray-900 rounded-lg p-1">
                    {['All', 'Positive', 'Neutral', 'Negative'].map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setSelectedFilter(filter)}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                          selectedFilter === filter
                            ? 'bg-twitch text-white'
                            : 'text-gray-400 hover:text-twitch hover:bg-gray-900'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                  <span className="text-gray-400 text-sm">
                    {formatNumber(filteredMessages.length)} messages
                  </span>
                </div>

                {isConnected && messages.length > 0 ? (
                  <div className="h-[600px]">
                    <List
                      height={600}
                      itemCount={filteredMessages.length}
                      itemSize={64} // Adjust for your message height + spacing
                      width={"100%"}
                      itemData={filteredMessages}
                      ref={chatContainerRef}
                      onScroll={({ scrollOffset, scrollUpdateWasRequested }) => {
                        // If user scrolls up, disable autoScroll
                        if (!scrollUpdateWasRequested) {
                          const atBottom =
                            scrollOffset >=
                            filteredMessages.length * 64 - 600 - 10; // 10px leeway
                          setAutoScroll(atBottom);
                          setShowScrollButton(!atBottom);
                        }
                      }}
                    >
                      {ChatRow}
                    </List>
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
