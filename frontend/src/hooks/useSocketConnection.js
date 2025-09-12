import { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL;

export const useSocketConnection = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'disconnected', 'connecting', 'connected', 'reconnecting'
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastError, setLastError] = useState(null);
  
  const socketRef = useRef(null);
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
    
    if (socketRef.current) {
      // Clear health check interval
      if (socketRef.current.healthCheckInterval) {
        clearInterval(socketRef.current.healthCheckInterval);
      }
      
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  // Connect to socket with robust configuration
  const connect = useCallback((userId = null) => {
    cleanup();
    
    setConnectionStatus('connecting');
    setLastError(null);

    const socket = io(API_URL, {
      transports: ['websocket', 'polling'], // Fallback to polling if websocket fails
      withCredentials: true,
      reconnection: false, // We'll handle reconnection manually
      timeout: 20000, // 20 seconds timeout
      autoConnect: true,
      // More conservative ping settings to match backend
      pingInterval: 25000, // 25 seconds to match backend
      pingTimeout: 60000,  // 60 seconds to match backend
      // Connection options
      forceNew: true,
      multiplex: false,
      // Additional options for stability
      upgrade: true,
      rememberUpgrade: false,
      perMessageDeflate: false,
      // Additional stability options
      closeOnBeforeunload: false,
      rejectUnauthorized: false // For development/testing
    });

    // Connection established
    socket.on('connect', () => {
      console.log('Socket connected successfully');
      setIsConnected(true);
      setConnectionStatus('connected');
      setReconnectAttempts(0);
      setLastError(null);
      
      // Map user session if userId provided
      if (userId) {
        socket.emit('map_user_session', { user_id: userId });
        console.log('Mapped user session:', userId);
      }
      
          // Set up periodic health check
      const healthCheck = setInterval(() => {
        if (socket.connected) {
          socket.emit('ping');
          // Also request connection status periodically
          socket.emit('request_connection_status');
        } else {
          clearInterval(healthCheck);
        }
      }, 30000); // Check every 30 seconds
      
      // Store health check interval for cleanup
      socket.healthCheckInterval = healthCheck;
    });

    // Connection lost
    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
      setConnectionStatus('disconnected');
      
      // Don't attempt reconnection for certain reasons
      if (reason === 'io client disconnect' || reason === 'io server disconnect') {
        console.log('Disconnect was intentional, not reconnecting');
        return;
      }
      
      // Attempt reconnection for network issues
      if (reconnectAttempts < maxReconnectAttempts) {
        setConnectionStatus('reconnecting');
        const delay = getReconnectDelay(reconnectAttempts);
        console.log(`Attempting reconnection ${reconnectAttempts + 1}/${maxReconnectAttempts} in ${delay}ms`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectAttempts(prev => prev + 1);
          connect(userId);
        }, delay);
      } else {
        setLastError('Max reconnection attempts reached');
        setConnectionStatus('failed');
        console.error('Max reconnection attempts reached');
      }
    });

    // Handle pong responses
    socket.on('pong', (data) => {
      console.log('Received pong:', data);
    });

    // Handle connection status updates
    socket.on('connection_status', (data) => {
      console.log('Connection status update:', data);
      if (data.status === 'connected') {
        setIsConnected(true);
        setConnectionStatus('connected');
        setLastError(null);
      }
    });

    // Handle connection error acknowledgment
    socket.on('connection_error_ack', (data) => {
      console.log('Connection error acknowledged:', data);
    });

    // Handle connection status response
    socket.on('connection_status_response', (data) => {
      console.log('Connection status response:', data);
      setIsConnected(data.status === 'connected');
      setConnectionStatus(data.status);
    });

    // Connection errors
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setLastError(error.message || 'Connection failed');
      setConnectionStatus('error');
      
      // Report the error to the server
      if (socket.connected) {
        socket.emit('connection_error', { error: error.message || 'Connection failed' });
      }
    });

    // Reconnection events
    socket.on('reconnect', (attemptNumber) => {
      console.log(`Reconnected after ${attemptNumber} attempts`);
      setConnectionStatus('connected');
      setReconnectAttempts(0);
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`Reconnection attempt ${attemptNumber}`);
      setConnectionStatus('reconnecting');
    });

    socket.on('reconnect_error', (error) => {
      console.error('Reconnection error:', error);
      setLastError(error.message || 'Reconnection failed');
    });

    socket.on('reconnect_failed', () => {
      console.error('Reconnection failed');
      setLastError('Reconnection failed');
      setConnectionStatus('failed');
    });

    socketRef.current = socket;
    return socket;
  }, [reconnectAttempts, getReconnectDelay, cleanup]);

  // Disconnect socket
  const disconnect = useCallback(() => {
    cleanup();
    setIsConnected(false);
    setConnectionStatus('disconnected');
    setReconnectAttempts(0);
    setLastError(null);
  }, [cleanup]);

  // Force reconnection
  const reconnect = useCallback((userId = null) => {
    setReconnectAttempts(0);
    connect(userId);
  }, [connect]);

  // Request connection status
  const requestConnectionStatus = useCallback(() => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('request_connection_status');
    }
  }, []);

  // Report connection error
  const reportConnectionError = useCallback((error) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('connection_error', { error });
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    socket: socketRef.current,
    isConnected,
    connectionStatus,
    reconnectAttempts,
    lastError,
    connect,
    disconnect,
    reconnect,
    requestConnectionStatus,
    reportConnectionError
  };
};
