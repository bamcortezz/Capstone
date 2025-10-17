import { useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAnalyze } from "../contexts/AnalyzeContext";
import { useAuth } from "../contexts/AuthContext";
import NavigationConfirmationModal from "../components/NavigationConfirmationModal";

export const useNavigationBlock = () => {
  const {
    isConnected,
    disconnectFromChannel,
    messages,
    sentimentCounts,
    userSentiments,
    currentChannel,
    sessionStart,
    timeSeries,
  } = useAnalyze();
  const { user, ensureValidToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Function to save analysis data
  const saveAnalysis = useCallback(async () => {
    try {
      // Ensure token is valid before attempting to save
      await ensureValidToken();

      const elapsed = sessionStart
        ? Math.floor((Date.now() - sessionStart) / 1000)
        : 0;

      const getTopContributors = (sentimentType, limit = 5) => {
        const contributors = Object.entries(userSentiments[sentimentType] || {})
          .map(([username, count]) => ({ username, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, limit);
        return contributors;
      };

      // Aggregate timeSeries into per-minute data to reduce storage (99.7% reduction)
      const buckets = new Map();
      for (const p of timeSeries || []) {
        const xMs = typeof p.x === "number" ? p.x : Date.now();
        const minute = Math.floor((xMs - (sessionStart || 0)) / 60000);
        if (minute >= 0) {
          const prev = buckets.get(minute) || { sum: 0, count: 0 };
          prev.sum += typeof p.y === "number" ? p.y : 0;
          prev.count += 1;
          buckets.set(minute, prev);
        }
      }
      const aggregatedTimeSeries = Array.from(buckets.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([minute, { sum, count }]) => ({
          x: (sessionStart || 0) + minute * 60000,
          y: count > 0 ? sum / count : 0,
        }));

      const analysisData = {
        streamer_name: currentChannel,
        total_chats: messages.length,
        sentiment_count: sentimentCounts,
        top_positive: getTopContributors("positive"),
        top_negative: getTopContributors("negative"),
        top_neutral: getTopContributors("neutral"),
        duration: elapsed,
        time_series: aggregatedTimeSeries,
      };

      const API_URL = import.meta.env.VITE_API_URL;
      const response = await fetch(`${API_URL}/api/history/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(analysisData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save analysis");
      }

      return true;
    } catch (error) {
      console.error("Save failed:", error);
      throw error;
    }
  }, [
    messages,
    sentimentCounts,
    userSentiments,
    currentChannel,
    sessionStart,
    timeSeries,
    ensureValidToken,
  ]);

  // Handle navigation - allow page changes but keep analysis running
  const handleNavigation = useCallback(
    async (targetPath) => {
      // Always allow navigation - analysis will continue running in background
      navigate(targetPath);
    },
    [navigate]
  );

  // Handle logout with confirmation
  const handleLogout = useCallback(
    async (logoutFunction) => {
      if (!isConnected) {
        await logoutFunction();
        return;
      }

      const result = await NavigationConfirmationModal.showLogoutConfirmation(
        !!user
      );

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
        console.error("Logout error:", error);
        await NavigationConfirmationModal.showError(
          "Error",
          "Failed to process logout. Please try again."
        );
      }
    },
    [isConnected, user, saveAnalysis, disconnectFromChannel]
  );

  // Block tab closure and page refresh during analysis
  useEffect(() => {
    if (!isConnected) return;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue =
        "You are currently analyzing a channel. Are you sure you want to leave?";
      return event.returnValue;
    };

    // Only prevent tab closure and page refresh, allow normal navigation
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isConnected]);

  return {
    handleNavigation,
    handleLogout,
    isAnalyzing: isConnected,
  };
};
