// Simple test utility to verify socket connection
import io from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL;

export const testSocketConnection = () => {
  console.log('Testing Socket.IO connection...');
  
  const socket = io(API_URL, {
    transports: ['websocket', 'polling'],
    withCredentials: true,
    reconnection: false,
    timeout: 10000,
    autoConnect: true,
    pingInterval: 60000,
    pingTimeout: 30000,
    forceNew: true,
    multiplex: false
  });

  socket.on('connect', () => {
    console.log('✅ Socket connected successfully');
    console.log('Socket ID:', socket.id);
    console.log('Transport:', socket.io.engine.transport.name);
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Socket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.log('❌ Connection error:', error.message);
  });

  socket.on('welcome', (data) => {
    console.log('📨 Received welcome message:', data);
  });

  // Test connection for 10 seconds
  setTimeout(() => {
    console.log('🔌 Closing test connection...');
    socket.disconnect();
  }, 10000);

  return socket;
};

// Test reconnection logic
export const testReconnection = () => {
  console.log('Testing reconnection logic...');
  
  let reconnectAttempts = 0;
  const maxAttempts = 5;
  const baseDelay = 1000;
  
  const attemptReconnection = () => {
    if (reconnectAttempts >= maxAttempts) {
      console.log('❌ Max reconnection attempts reached');
      return;
    }
    
    reconnectAttempts++;
    const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempts - 1), 10000);
    console.log(`🔄 Reconnection attempt ${reconnectAttempts}/${maxAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      const socket = testSocketConnection();
      
      socket.on('connect', () => {
        console.log(`✅ Reconnected successfully on attempt ${reconnectAttempts}`);
        socket.disconnect();
      });
      
      socket.on('connect_error', () => {
        console.log(`❌ Reconnection attempt ${reconnectAttempts} failed`);
        attemptReconnection();
      });
    }, delay);
  };
  
  // Start with a failed connection
  const socket = io(API_URL, {
    transports: ['websocket'],
    withCredentials: true,
    reconnection: false,
    timeout: 1000, // Very short timeout to force failure
    autoConnect: true
  });
  
  socket.on('connect_error', () => {
    console.log('❌ Initial connection failed (expected)');
    socket.disconnect();
    attemptReconnection();
  });
};

// Export for use in browser console
if (typeof window !== 'undefined') {
  window.testSocketConnection = testSocketConnection;
  window.testReconnection = testReconnection;
}
