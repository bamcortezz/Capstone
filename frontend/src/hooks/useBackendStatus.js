import { useState, useEffect } from 'react';

const useBackendStatus = () => {
  const [isBackendReady, setIsBackendReady] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch('http://localhost:5000/');
        if (response.ok) {
          setIsBackendReady(true);
        }
      } catch (error) {
        setIsBackendReady(false);
      } finally {
        setIsChecking(false);
      }
    };

    // Check immediately
    checkBackend();

    // Check every 5 seconds until backend is ready
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
