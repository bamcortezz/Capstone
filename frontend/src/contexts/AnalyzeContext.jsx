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
  const messageQueue = useRef([]);
  const [sessionStart, setSessionStart] = useState(null);
  const sessionStartRef = useRef(null);

  useEffect(() => {
    const processQueue = () => {
      if (messageQueue.current.length === 0) return;
      const newMessages = [...messageQueue.current];
      messageQueue.current = [];
      setMessages((prev) => [...prev, ...newMessages]);
      const newSentimentCounts = { positive: 0, neutral: 0, negative: 0 };
      const newUserSentiments = {};
      newMessages.forEach((msg) => {
        newSentimentCounts[msg.sentiment] += 1;
        if (!newUserSentiments[msg.sentiment]) newUserSentiments[msg.sentiment] = {};
        if (!newUserSentiments[msg.sentiment][msg.username]) newUserSentiments[msg.sentiment][msg.username] = 0;
        newUserSentiments[msg.sentiment][msg.username] += 1;
      });
      setSentimentCounts((prev) => ({
        positive: prev.positive + newSentimentCounts.positive,
        neutral: prev.neutral + newSentimentCounts.neutral,
        negative: prev.negative + newSentimentCounts.negative
      }));
      setUserSentiments((prev) => {
        const updated = JSON.parse(JSON.stringify(prev));
        for (const sentiment in newUserSentiments) {
          for (const username in newUserSentiments[sentiment]) {
            if (!updated[sentiment]) updated[sentiment] = {};
            if (!updated[sentiment][username]) updated[sentiment][username] = 0;
            updated[sentiment][username] += newUserSentiments[sentiment][username];
          }
        }
        return updated;
      });
    };
    const intervalId = setInterval(processQueue, 1000);
    return () => clearInterval(intervalId);
  }, []);

  // Socket connection management
  const connectToChannel = useCallback(async (streamUrl) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    // Connect to backend socket
    socketRef.current = io(API_URL);
    processedMessages.current.clear();
    setMessages([]);
    setSentimentCounts({ positive: 0, neutral: 0, negative: 0 });
    setUserSentiments({ positive: {}, neutral: {}, negative: {} });
    setIsConnected(false);
    setCurrentChannel(null);

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

    if (user) {
      try {
        await fetch(`${API_URL}/api/log/analysis-start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ streamer: data.channel }),
        });
      } catch (e) {  }
    }
    // Setup socket listeners
    socketRef.current.on('connect', () => {
    });
    socketRef.current.on('chat_message', (msg) => {
      const messageId = `${msg.username}-${msg.message}`;
      if (!processedMessages.current.has(messageId)) {
        processedMessages.current.add(messageId);
        messageQueue.current.push({ ...msg, id: messageId });
      }
    });
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
  }, [user]);

  const disconnectFromChannel = useCallback(async () => {
    if (currentChannel) {
      try {
        await fetch(`${API_URL}/api/twitch/disconnect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ channel: currentChannel }),
        });
      } catch (e) {  }
    }
    if (socketRef.current) {
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