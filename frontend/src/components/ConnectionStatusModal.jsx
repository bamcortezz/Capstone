import React, { useState, useEffect } from 'react';
import { useAnalyze } from '../contexts/AnalyzeContext';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';

const ConnectionStatusModal = ({ isAnalyzing, onSaveAnalysis, onDiscardAnalysis, analysisData }) => {
  const { connectionStatus, sseConnected, reconnect } = useAnalyze();
  const { user } = useAuth();
  
  // For SSE, we don't have reconnectAttempts or lastError in the same way
  const reconnectAttempts = 0; // SSE handles reconnection automatically
  const lastError = null; // SSE errors are handled differently
  const isConnected = sseConnected;
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [disconnectTimer, setDisconnectTimer] = useState(null);

  // Monitor connection status changes
  useEffect(() => {
    if (isAnalyzing && !isConnected && connectionStatus === 'disconnected') {
      // Show disconnect modal after a short delay to allow for reconnection attempts
      const timer = setTimeout(() => {
        if (!isConnected) {
          setShowDisconnectModal(true);
        }
      }, 5000); // Wait 5 seconds before showing the modal
      
      setDisconnectTimer(timer);
    } else if (isConnected && showDisconnectModal) {
      // Hide modal if connection is restored
      setShowDisconnectModal(false);
      if (disconnectTimer) {
        clearTimeout(disconnectTimer);
        setDisconnectTimer(null);
      }
    }

    return () => {
      if (disconnectTimer) {
        clearTimeout(disconnectTimer);
      }
    };
  }, [isConnected, connectionStatus, isAnalyzing, showDisconnectModal, disconnectTimer]);

  // Handle save analysis
  const handleSaveAnalysis = async () => {
    try {
      if (onSaveAnalysis && analysisData) {
        await onSaveAnalysis(analysisData);
        setShowDisconnectModal(false);
        Swal.fire({
          title: 'Success',
          text: 'Analysis saved successfully!',
          icon: 'success',
          background: '#18181b',
          color: '#fff',
          confirmButtonColor: '#9147ff'
        });
      }
    } catch (error) {
      console.error('Error saving analysis:', error);
      Swal.fire({
        title: 'Error',
        text: 'Failed to save analysis. Please try again.',
        icon: 'error',
        background: '#18181b',
        color: '#fff',
        confirmButtonColor: '#9147ff'
      });
    }
  };

  // Handle discard analysis
  const handleDiscardAnalysis = () => {
    Swal.fire({
      title: 'Discard Analysis?',
      text: 'Are you sure you want to discard the current analysis? This action cannot be undone.',
      icon: 'warning',
      background: '#18181b',
      color: '#fff',
      confirmButtonColor: '#9147ff',
      cancelButtonColor: '#dc2626',
      showCancelButton: true,
      confirmButtonText: 'Yes, discard',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        if (onDiscardAnalysis) {
          onDiscardAnalysis();
        }
        setShowDisconnectModal(false);
      }
    });
  };

  // Handle manual reconnection
  const handleReconnect = () => {
    // For SSE, reconnection is handled automatically by the browser
    // We can trigger a page refresh or reconnect the SSE connection
    if (reconnect) {
      reconnect(); // This will reconnect the SSE connection
    }
  };

  // Show connection status notification
  useEffect(() => {
    if (connectionStatus === 'reconnecting') {
      Swal.fire({
        title: 'Reconnecting...',
        text: 'Attempting to reconnect to the server',
        icon: 'info',
        background: '#18181b',
        color: '#fff',
        confirmButtonColor: '#9147ff',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    }
  }, [connectionStatus]);

  // Don't render anything if not analyzing or if connected
  if (!isAnalyzing || isConnected) {
    return null;
  }

  return (
    <>
      {/* Connection Status Banner */}
      {!isConnected && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white p-3 text-center">
          <div className="flex items-center justify-center space-x-2">
            <svg className="w-5 h-5 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">
              Connection Lost
              {connectionStatus === 'reconnecting' && ' - Reconnecting...'}
            </span>
            <button
              onClick={handleReconnect}
              className="ml-2 px-3 py-1 bg-white text-red-600 rounded text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Disconnect Modal */}
      {showDisconnectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
            <div className="flex items-center mb-4">
              <svg className="w-8 h-8 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <h3 className="text-xl font-bold text-white">Connection Lost</h3>
            </div>
            
            <p className="text-gray-300 mb-6">
              Your connection to the server has been lost. You can save your current analysis or discard it and start over.
            </p>
            
            <div className="flex space-x-3">
              <button
                onClick={handleSaveAnalysis}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Save Analysis
              </button>
              <button
                onClick={handleDiscardAnalysis}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Discard
              </button>
              <button
                onClick={handleReconnect}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Retry Connection
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ConnectionStatusModal;
