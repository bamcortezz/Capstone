import { useState, useEffect, useRef, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL;

export const useWebSocketConnection = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'disconnected', 'connecting', 'connected', 'reconnecting'
  const [lastError, setLastError] = useState(null);
  
  const websocketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const maxReconnectAttempts = 10;
  const baseReconnectDelay = 1000; // 1 second
  const maxReconnectDelay = 30000; // 30 seconds
  const heartbeatInterval = 30000; // 30 seconds

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
    
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
  }, []);

  // Start heartbeat
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    
    heartbeatIntervalRef.current = setInterval(() => {
      if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
        websocketRef.current.send(JSON.stringify({
          type: 'ping',
          timestamp: new Date().toISOString()
        }));
      }
    }, heartbeatInterval);
  }, []);

  // Connect to WebSocket
  const connect = useCallback((channel) => {
    cleanup();
    
    setConnectionStatus('connecting');
    setLastError(null);

    // Convert HTTP URL to WebSocket URL
    const wsUrl = API_URL.replace('http://', 'ws://').replace('https://', 'wss://');
    const websocket = new WebSocket(`${wsUrl}/ws/chat/${channel}`);
    websocketRef.current = websocket;

    // Connection established
    websocket.onopen = () => {
      console.log('WebSocket connected successfully');
      setIsConnected(true);
      setConnectionStatus('connected');
      setLastError(null);
      startHeartbeat();
    };

    // Handle messages
    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);
        
        // Handle different message types
        if (data.type === 'pong') {
          console.log('WebSocket pong received');
        } else if (data.type === 'heartbeat') {
          console.log('WebSocket heartbeat received');
        } else if (data.type === 'message') {
          // This will be handled by the calling component
          return data.data;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    // Connection lost
    websocket.onerror = (error) => {
      console.error('WebSocket connection error:', error);
      setLastError('Connection error');
    };

    websocket.onclose = (event) => {
      console.log('WebSocket connection closed:', event.code, event.reason);
      setIsConnected(false);
      setConnectionStatus('disconnected');
      
      // Attempt reconnection if not a clean close
      if (event.code !== 1000 && event.code !== 1001) {
        console.log('WebSocket connection lost, attempting reconnection...');
        setConnectionStatus('reconnecting');
        
        // Use exponential backoff for reconnection
        const delay = getReconnectDelay(0); // Start with first attempt
        reconnectTimeoutRef.current = setTimeout(() => {
          connect(channel);
        }, delay);
      }
    };

    return websocket;
  }, [getReconnectDelay, cleanup, startHeartbeat]);

  // Disconnect WebSocket
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
    websocket: websocketRef.current,
    isConnected,
    connectionStatus,
    lastError,
    connect,
    disconnect,
    reconnect
  };
};

// Hook for connection status WebSocket
export const useWebSocketStatus = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState(null);
  
  const websocketRef = useRef(null);

  const connect = useCallback(() => {
    if (websocketRef.current) {
      websocketRef.current.close();
    }

    // Convert HTTP URL to WebSocket URL
    const wsUrl = API_URL.replace('http://', 'ws://').replace('https://', 'wss://');
    const websocket = new WebSocket(`${wsUrl}/ws/status`);
    websocketRef.current = websocket;

    websocket.onopen = () => {
      console.log('WebSocket status connected');
      setIsConnected(true);
      setLastError(null);
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'status') {
          console.log('WebSocket status update:', data.status);
        }
      } catch (error) {
        console.error('Error parsing WebSocket status message:', error);
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket status error:', error);
      setIsConnected(false);
      setLastError('Status connection error');
    };

    websocket.onclose = () => {
      setIsConnected(false);
    };

  }, []);

  const disconnect = useCallback(() => {
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
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
