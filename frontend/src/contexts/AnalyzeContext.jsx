import React, { createContext, useContext, useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useSSEConnection } from '../hooks/useSSEConnection';

const API_URL = import.meta.env.VITE_API_URL;

const AnalyzeContext = createContext();

export const useAnalyze = () => useContext(AnalyzeContext);

export const AnalyzeProvider = ({ children }) => {
  const { user } = useAuth();
  const { eventSource, isConnected: sseConnected, connectionStatus, connect: connectSSE, disconnect: disconnectSSE } = useSSEConnection();
  const [isConnected, setIsConnected] = useState(false);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sentimentCounts, setSentimentCounts] = useState({ positive: 0, neutral: 0, negative: 0 });
  const [userSentiments, setUserSentiments] = useState({ positive: {}, neutral: {}, negative: {} });
  const processedMessages = useRef(new Set());
  const [sessionStart, setSessionStart] = useState(null);
  const sessionStartRef = useRef(null);

  // Process incoming messages and update state
  const processMessage = useCallback((msg) => {
    const messageId = `${msg.username}-${msg.message}`;
    if (!processedMessages.current.has(messageId)) {
      processedMessages.current.add(messageId);
      
      setMessages((prev) => [...prev, msg]);

      // Use functional updates to avoid stale closure issues
      setSentimentCounts((prev) => ({
        ...prev,
        [msg.sentiment]: (prev[msg.sentiment] || 0) + 1
      }));

      setUserSentiments((prev) => {
        const updated = { ...prev };
        if (!updated[msg.sentiment]) {
          updated[msg.sentiment] = {};
        }
        updated[msg.sentiment] = {
          ...updated[msg.sentiment],
          [msg.username]: (updated[msg.sentiment][msg.username] || 0) + 1
        };
        return updated;
      });
    }
  }, []); // Remove dependencies to avoid stale closures

  // SSE connection management
  const connectToChannel = useCallback(async (streamUrl) => {
    // Check if user is logged in
    if (!user) {
      throw new Error('User not logged in. Please log in to analyze chat.');
    }

    // Cleanup previous SSE connection
    disconnectSSE();
    
    setMessages([]);
    setSentimentCounts({ positive: 0, neutral: 0, negative: 0 });
    setUserSentiments({ positive: {}, neutral: {}, negative: {} });

    const response = await fetch(`${API_URL}/api/twitch/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: streamUrl }),
      credentials: 'include',
    });

    if (!response.ok) throw new Error('Failed to connect to channel');
    const data = await response.json();
    setIsConnected(true);
    setCurrentChannel(data.channel);

    if (!sessionStartRef.current) {
      const now = Date.now();
      setSessionStart(now);
      sessionStartRef.current = now;
    }

    // Log the start of the analysis if the user is authenticated
    if (user) {
      try {
        const logResponse = await fetch(`${API_URL}/api/log/analysis-start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ streamer: data.channel }),
        });
        
        if (!logResponse.ok) {
          console.warn("Failed to log analysis start:", logResponse.status, logResponse.statusText);
        }
      } catch (e) {
        console.warn("Error logging analysis start (non-critical):", e.message);
        // Don't throw error as this is not critical for the main functionality
      }
    }

    // Setup SSE connection for the channel with message callback
    const messageHandler = (messageData) => {
      processMessage(messageData);
    };
    
    const sseEventSource = connectSSE(data.channel, messageHandler);
  }, [user, processMessage, connectSSE, disconnectSSE]);

  const disconnectFromChannel = useCallback(async () => {
    if (currentChannel) {
      try {
        await fetch(`${API_URL}/api/twitch/disconnect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ channel: currentChannel }),
        });
      } catch (e) {
        console.error("Error disconnecting from channel", e);
      }
    }

    // Disconnect SSE connection
    disconnectSSE();

    setIsConnected(false);
    setCurrentChannel(null);
    setMessages([]);
    setSentimentCounts({ positive: 0, neutral: 0, negative: 0 });
    setUserSentiments({ positive: {}, neutral: {}, negative: {} });
    processedMessages.current.clear();

    setSessionStart(null);
    sessionStartRef.current = null;
  }, [currentChannel]);

  useEffect(() => {
    return () => {
      // Cleanup SSE connection on unmount
      disconnectSSE();
    };
  }, [disconnectSSE]);

  const topUsers = useMemo(() => {
    const sentiments = ['positive', 'neutral', 'negative'];
    const result = {};
    sentiments.forEach(sentiment => {
      const entries = Object.entries(userSentiments[sentiment] || {});
      if (entries.length === 0) {
        result[sentiment] = ['-', 0];
      } else {
        result[sentiment] = entries.sort(([, a], [, b]) => b - a)[0];
      }
    });
    return result;
  }, [userSentiments]);

  const getFilteredMessages = useCallback((selectedFilter) => {
    if (selectedFilter === 'All') return messages;
    return messages.filter(msg => msg.sentiment.toLowerCase() === selectedFilter.toLowerCase());
  }, [messages]);

  return (
    <AnalyzeContext.Provider value={{
      isConnected,
      currentChannel,
      messages,
      sentimentCounts,
      userSentiments,
      connectToChannel,
      disconnectFromChannel,
      topUsers,
      getFilteredMessages,
      sessionStart,
      setSessionStart,
      sseConnected,
      connectionStatus,
    }}>
      {children}
    </AnalyzeContext.Provider>
  );
};
