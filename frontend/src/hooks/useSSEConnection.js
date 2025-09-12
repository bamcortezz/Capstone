import { useState, useEffect, useRef, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL;

export const useSSEConnection = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'disconnected', 'connecting', 'connected', 'reconnecting'
  const [lastError, setLastError] = useState(null);
  
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const maxReconnectAttempts = 10;
  const baseReconnectDelay = 1000; // 1 second
  const maxReconnectDelay = 30000; // 30 seconds

  // Calculate exponential backoff delay
  const getReconnectDelay = useCallback((attempt) => {
    const delay = Math.min(
      baseReconnectDelay * Math.pow(2, attempt),
      maxReconnectDelay
    );
    // Add some jitter to prevent thundering herd
    return delay + Math.random() * 1000;
  }, []);

  // Clean up existing connection
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  // Connect to SSE stream
  const connect = useCallback((channel, onMessage) => {
    cleanup();
    
    setConnectionStatus('connecting');
    setLastError(null);

    const eventSource = new EventSource(`${API_URL}/api/sse/chat/${channel}`);
    eventSourceRef.current = eventSource;

    // Connection established
    eventSource.onopen = () => {
      console.log('SSE connected successfully');
      setIsConnected(true);
      setConnectionStatus('connected');
      setLastError(null);
    };

    // Handle messages
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('SSE message received:', data);
        
        // Handle different message types
        if (data.type === 'connection') {
          console.log('SSE connection established for channel:', data.channel);
        } else if (data.type === 'heartbeat') {
          console.log('SSE heartbeat received');
        } else if (data.type === 'message') {
          // Call the message callback if provided
          if (onMessage && typeof onMessage === 'function') {
            onMessage(data.data);
          }
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    // Connection lost
    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      setIsConnected(false);
      setConnectionStatus('disconnected');
      setLastError('Connection lost');
      
      // Attempt reconnection
      if (eventSource.readyState === EventSource.CLOSED) {
        console.log('SSE connection closed, attempting reconnection...');
        setConnectionStatus('reconnecting');
        
        // Use exponential backoff for reconnection
        const delay = getReconnectDelay(0); // Start with first attempt
        reconnectTimeoutRef.current = setTimeout(() => {
          connect(channel, onMessage);
        }, delay);
      }
    };

    return eventSource;
  }, [getReconnectDelay, cleanup]);

  // Disconnect SSE
  const disconnect = useCallback(() => {
    cleanup();
    setIsConnected(false);
    setConnectionStatus('disconnected');
    setLastError(null);
  }, [cleanup]);

  // Force reconnection
  const reconnect = useCallback((channel) => {
    disconnect();
    setTimeout(() => connect(channel), 1000);
  }, [connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    eventSource: eventSourceRef.current,
    isConnected,
    connectionStatus,
    lastError,
    connect,
    disconnect,
    reconnect
  };
};

// Hook for connection status SSE
export const useSSEStatus = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState(null);
  
  const eventSourceRef = useRef(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`${API_URL}/api/sse/status`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('SSE status connected');
      setIsConnected(true);
      setLastError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'status') {
          console.log('SSE status update:', data.status);
        }
      } catch (error) {
        console.error('Error parsing SSE status message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE status error:', error);
      setIsConnected(false);
      setLastError('Status connection lost');
    };

  }, []);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    isConnected,
    lastError,
    connect,
    disconnect
  };
};
