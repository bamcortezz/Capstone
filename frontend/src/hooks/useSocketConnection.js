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
      // Clear health check intervals
      if (socketRef.current.healthCheckInterval) {
        clearInterval(socketRef.current.healthCheckInterval);
      }
      if (socketRef.current.heartbeatInterval) {
        clearInterval(socketRef.current.heartbeatInterval);
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
      timeout: 30000, // 30 seconds timeout
      autoConnect: true,
      // More aggressive ping settings for Railway
      pingInterval: 30000, // 30 seconds to match backend
      pingTimeout: 120000,  // 120 seconds to match backend
      // Connection options
      forceNew: true,
      multiplex: false,
      // Additional options for stability
      upgrade: true,
      rememberUpgrade: false,
      perMessageDeflate: false,
      // Additional stability options
      closeOnBeforeunload: false,
      rejectUnauthorized: false, // For development/testing
      // Railway-specific optimizations
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      maxReconnectionAttempts: 10
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
      
          // Set up aggressive health check and heartbeat
      const healthCheck = setInterval(() => {
        if (socket.connected) {
          socket.emit('ping');
          socket.emit('heartbeat');
          socket.emit('keepalive');
          // Also request connection status periodically
          socket.emit('request_connection_status');
        } else {
          clearInterval(healthCheck);
        }
      }, 15000); // Check every 15 seconds - more aggressive
      
      // Additional heartbeat every 10 seconds
      const heartbeatCheck = setInterval(() => {
        if (socket.connected) {
          socket.emit('heartbeat');
        } else {
          clearInterval(heartbeatCheck);
        }
      }, 10000); // Heartbeat every 10 seconds
      
      // Store intervals for cleanup
      socket.healthCheckInterval = healthCheck;
      socket.heartbeatInterval = heartbeatCheck;
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
      
      // Attempt reconnection for network issues - more aggressive for Railway
      if (reconnectAttempts < maxReconnectAttempts) {
        setConnectionStatus('reconnecting');
        // Use shorter delays for Railway
        const delay = Math.min(getReconnectDelay(reconnectAttempts), 5000);
        console.log(`Attempting reconnection ${reconnectAttempts + 1}/${maxReconnectAttempts} in ${delay}ms`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectAttempts(prev => prev + 1);
          connect(userId);
        }, delay);
      } else {
        setLastError('Max reconnection attempts reached');
        setConnectionStatus('failed');
        console.error('Max reconnection attempts reached');
        
        // Reset attempts after a longer delay to allow for manual retry
        setTimeout(() => {
          setReconnectAttempts(0);
          setConnectionStatus('disconnected');
        }, 30000); // Reset after 30 seconds
      }
    });

    // Handle pong responses
    socket.on('pong', (data) => {
      console.log('Received pong:', data);
    });

    // Handle heartbeat responses
    socket.on('heartbeat_ack', (data) => {
      console.log('Received heartbeat ack:', data);
    });

    // Handle keepalive responses
    socket.on('keepalive_ack', (data) => {
      console.log('Received keepalive ack:', data);
    });

    // Handle server keepalive
    socket.on('server_keepalive', (data) => {
      console.log('Received server keepalive:', data);
      // Respond to server keepalive
      socket.emit('client_keepalive_ack', {
        timestamp: new Date().toISOString(),
        status: 'alive'
      });
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
