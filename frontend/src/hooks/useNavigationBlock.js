import { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAnalyze } from '../contexts/AnalyzeContext';
import { useAuth } from '../contexts/AuthContext';
import NavigationConfirmationModal from '../components/NavigationConfirmationModal';

export const useNavigationBlock = () => {
  const { isConnected, disconnectFromChannel, messages, sentimentCounts, userSentiments, currentChannel, sessionStart } = useAnalyze();
  const { user, ensureValidToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Function to save analysis data
  const saveAnalysis = useCallback(async () => {
    try {
      // Ensure token is valid before attempting to save
      await ensureValidToken();
      
      const elapsed = sessionStart ? Math.floor((Date.now() - sessionStart) / 1000) : 0;
      
      const getTopContributors = (sentimentType, limit = 5) => {
        const contributors = Object.entries(userSentiments[sentimentType] || {})
          .map(([username, count]) => ({ username, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, limit);
        return contributors;
      };

      const analysisData = {
        streamer_name: currentChannel,
        total_chats: messages.length,
        sentiment_count: sentimentCounts,
        top_positive: getTopContributors('positive'),
        top_negative: getTopContributors('negative'),
        top_neutral: getTopContributors('neutral'),
        duration: elapsed
      };

      const API_URL = import.meta.env.VITE_API_URL;
      const response = await fetch(`${API_URL}/api/history/save`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(analysisData)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save analysis');
      }

      return true;
    } catch (error) {
      console.error('Save failed:', error);
      throw error;
    }
  }, [messages, sentimentCounts, userSentiments, currentChannel, sessionStart]);

  // Handle navigation with confirmation
  const handleNavigation = useCallback(async (targetPath) => {
    if (!isConnected) {
      navigate(targetPath);
      return;
    }

    const result = await NavigationConfirmationModal.showNavigationConfirmation(!!user);
    
    if (!result.shouldLeave) {
      return; // User chose to stay
    }

    try {
      if (result.shouldSave && user) {
        await saveAnalysis();
        await NavigationConfirmationModal.showSaveSuccess();
      } else if (result.shouldDiscard) {
        await NavigationConfirmationModal.showDiscardMessage(!!user);
      }

      // Disconnect from analysis
      await disconnectFromChannel();
      
      // Navigate to target path
      navigate(targetPath);
    } catch (error) {
      console.error('Navigation error:', error);
      await NavigationConfirmationModal.showError('Error', 'Failed to process navigation. Please try again.');
    }
  }, [isConnected, user, saveAnalysis, disconnectFromChannel, navigate]);

  // Handle logout with confirmation
  const handleLogout = useCallback(async (logoutFunction) => {
    if (!isConnected) {
      await logoutFunction();
      return;
    }

    const result = await NavigationConfirmationModal.showLogoutConfirmation(!!user);
    
    if (!result.shouldLogout) {
      return; // User chose to cancel
    }

    try {
      if (result.shouldSave && user) {
        await saveAnalysis();
        await NavigationConfirmationModal.showSaveSuccess();
      } else if (result.shouldDiscard) {
        await NavigationConfirmationModal.showDiscardMessage(!!user);
      }

      // Disconnect from analysis
      await disconnectFromChannel();
      
      // Proceed with logout
      await logoutFunction();
    } catch (error) {
      console.error('Logout error:', error);
      await NavigationConfirmationModal.showError('Error', 'Failed to process logout. Please try again.');
    }
  }, [isConnected, user, saveAnalysis, disconnectFromChannel]);

  // Block browser navigation (back/forward buttons, page refresh, etc.)
  useEffect(() => {
    if (!isConnected) return;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = 'You are currently analyzing a channel. Are you sure you want to leave?';
      return event.returnValue;
    };

    const handlePopState = async (event) => {
      if (!isConnected) return;

      event.preventDefault();
      
      const result = await NavigationConfirmationModal.showNavigationConfirmation(!!user);
      
      if (result.shouldLeave) {
        try {
          if (result.shouldSave && user) {
            await saveAnalysis();
            await NavigationConfirmationModal.showSaveSuccess();
          } else if (result.shouldDiscard) {
            await NavigationConfirmationModal.showDiscardMessage(!!user);
          }

          await disconnectFromChannel();
          
          // Allow the navigation to proceed
          window.history.pushState(null, '', event.state?.url || '/');
          navigate(event.state?.url || '/', { replace: true });
        } catch (error) {
          console.error('Navigation error:', error);
          await NavigationConfirmationModal.showError('Error', 'Failed to process navigation. Please try again.');
        }
      } else {
        // Push the current state back to prevent navigation
        window.history.pushState(null, '', location.pathname);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isConnected, user, saveAnalysis, disconnectFromChannel, navigate, location.pathname]);

  return {
    handleNavigation,
    handleLogout,
    isAnalyzing: isConnected
  };
};
