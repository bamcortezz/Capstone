import React, { createContext, useContext, useState, useRef, useEffect, useMemo, useCallback } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const API_URL = import.meta.env.VITE_API_URL;

const AnalyzeContext = createContext();

export const useAnalyze = () => useContext(AnalyzeContext);

export const AnalyzeProvider = ({ children }) => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sentimentCounts, setSentimentCounts] = useState({ positive: 0, neutral: 0, negative: 0 });
  const [userSentiments, setUserSentiments] = useState({ positive: {}, neutral: {}, negative: {} });
  const socketRef = useRef(null);
  const processedMessages = useRef(new Set());
  const [sessionStart, setSessionStart] = useState(null);
  const sessionStartRef = useRef(null);

  // Process incoming messages and update state
  const processMessage = useCallback((msg) => {
    const messageId = `${msg.username}-${msg.message}`;
    if (!processedMessages.current.has(messageId)) {
      processedMessages.current.add(messageId);
      setMessages((prev) => [...prev, msg]);

      const updatedSentimentCounts = { ...sentimentCounts };
      updatedSentimentCounts[msg.sentiment] += 1;
      setSentimentCounts(updatedSentimentCounts);

      const updatedUserSentiments = { ...userSentiments };
      if (!updatedUserSentiments[msg.sentiment]) updatedUserSentiments[msg.sentiment] = {};
      updatedUserSentiments[msg.sentiment][msg.username] = (updatedUserSentiments[msg.sentiment][msg.username] || 0) + 1;
      setUserSentiments(updatedUserSentiments);
    }
  }, [sentimentCounts, userSentiments]);

  // Socket connection management
  const connectToChannel = useCallback(async (streamUrl) => {
    if (socketRef.current) {
      socketRef.current.off('chat_message');  // Cleanup previous listeners
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    // Connect to the socket
    socketRef.current = io(API_URL);
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
        await fetch(`${API_URL}/api/log/analysis-start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ streamer: data.channel }),
        });
      } catch (e) {
        console.error("Error logging analysis start", e);
      }
    }

    // Setup socket listeners for new messages and disconnects
    socketRef.current.on('connect', () => {});

    socketRef.current.on('chat_message', processMessage);  // Process incoming chat messages

    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
      setCurrentChannel(null);
      setMessages([]);
      setSentimentCounts({ positive: 0, neutral: 0, negative: 0 });
      setUserSentiments({ positive: {}, neutral: {}, negative: {} });
      processedMessages.current.clear();
    });

    socketRef.current.on('disconnect_notification', (data) => {
      if (data.channel === currentChannel) {
        setIsConnected(false);
        setCurrentChannel(null);
        setMessages([]);
        setSentimentCounts({ positive: 0, neutral: 0, negative: 0 });
        setUserSentiments({ positive: {}, neutral: {}, negative: {} });
        processedMessages.current.clear();
      }
    });
  }, [user, currentChannel, processMessage]);

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

    if (socketRef.current) {
      socketRef.current.off('chat_message');  // Cleanup listeners
      socketRef.current.disconnect();
      socketRef.current = null;
    }

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
      if (socketRef.current) {
        socketRef.current.off('chat_message');  // Cleanup listeners on unmount
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

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
      socketRef,
      connectToChannel,
      disconnectFromChannel,
      topUsers,
      getFilteredMessages,
      sessionStart,
      setSessionStart,
    }}>
      {children}
    </AnalyzeContext.Provider>
  );
};
