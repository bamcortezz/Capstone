import { useState, useEffect } from 'react';

// API URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const useBackendStatus = () => {
  const [isBackendReady, setIsBackendReady] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch(`${API_URL}/`);
        if (response.ok) {
          setIsBackendReady(true);
        }
      } catch (error) {
        setIsBackendReady(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkBackend();

    const intervalId = setInterval(() => {
      if (!isBackendReady) {
        checkBackend();
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [isBackendReady]);

  return { isBackendReady, isChecking };
};

export default useBackendStatus;
