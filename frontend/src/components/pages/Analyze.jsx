import React, { useState, useEffect, useRef, useMemo } from "react";
import { Pie, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
} from "chart.js";
import Swal from "sweetalert2";
import { useAuth } from "../../contexts/AuthContext";
import { useAnalyze } from "../../contexts/AnalyzeContext";
import { useHistory } from "../../contexts/HistoryContext";
import { useNavigationBlock } from "../../hooks/useNavigationBlock";
import { FixedSizeList as List } from "react-window";
import ConnectionStatusModal from "../ConnectionStatusModal";
import NavigationConfirmationModal from "../NavigationConfirmationModal";
import WordCloud from "../WordCloud";

// API URL
const API_URL = import.meta.env.VITE_API_URL;

const formatNumber = (num) => {
  if (typeof num !== "number") return num;
  return num.toLocaleString();
};

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  LinearScale,
  PointElement,
  LineElement,
  Filler
);

const SentimentPieChart = React.memo(({ sentimentCounts }) => {
  const chartData = useMemo(() => {
    const positive = sentimentCounts.positive || 0;
    const neutral = sentimentCounts.neutral || 0;
    const negative = sentimentCounts.negative || 0;
    const total = positive + neutral + negative;

    // If no data, show a placeholder
    if (total === 0) {
      return {
        labels: ["No Data"],
        datasets: [
          {
            data: [1],
            backgroundColor: ["#6B7280"],
            borderColor: ["#4B5563"],
            borderWidth: 1,
          },
        ],
      };
    }

    return {
      labels: ["Positive", "Neutral", "Negative"],
      datasets: [
        {
          data: [positive, neutral, negative],
          backgroundColor: ["#22c55e", "#fde047", "#ef4444"],
          borderColor: ["#16a34a", "#facc15", "#b91c1c"],
          borderWidth: 1,
        },
      ],
    };
  }, [sentimentCounts]);

  const chartOptions = useMemo(
    () => ({
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#D1D5DB",
            font: { size: 12 },
          },
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const label = context.label || "";
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage =
                total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return `${label}: ${value} (${percentage}%)`;
            },
          },
        },
      },
      maintainAspectRatio: false,
      responsive: true,
    }),
    []
  );

  return <Pie data={chartData} options={chartOptions} />;
});

const ChatRow = ({ index, style, data }) => {
  const msg = data[index];
  const sentimentColor =
    msg.sentiment === "positive"
      ? "text-green-400"
      : msg.sentiment === "negative"
      ? "text-red-400"
      : msg.sentiment === "neutral"
      ? "text-yellow-400"
      : "text-gray-400";
  return (
    <div
      style={style}
      key={msg.id}
      className={
        "flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg border-b border-gray-700 mb-2 bg-black"
      }
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:space-x-2 flex-1 min-w-0">
        <span className="text-twitch font-medium whitespace-nowrap mb-1 sm:mb-0">
          {msg.username}
          <span>:</span>
        </span>
        <span
          className={`break-words overflow-hidden max-w-full sm:max-w-[60%] line-clamp-2 sm:text-white ${sentimentColor}`}
          title={msg.message}
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          <span className="block sm:inline">{msg.message}</span>
        </span>
      </div>
      <span
        className={`hidden sm:inline ml-4 px-2 py-1 rounded text-xs font-bold uppercase whitespace-nowrap flex-shrink-0 ${
          msg.sentiment === "positive"
            ? "text-green-400"
            : msg.sentiment === "negative"
            ? "text-red-400"
            : msg.sentiment === "neutral"
            ? "text-yellow-400"
            : "text-gray-400"
        }`}
      >
        {msg.sentiment || "Unknown"}
      </span>
    </div>
  );
};

const Analyze = () => {
  const { user, getAuthHeaders, ensureValidToken } = useAuth();
  const { addAnalysis } = useHistory();
  const {
    isConnected,
    currentChannel,
    messages,
    sentimentCounts,
    userSentiments,
    wordFrequencies,
    timeSeries,
    connectToChannel,
    disconnectFromChannel,
    topUsers,
    getFilteredMessages,
    getTopWords,
    getAllTopWords,
    sessionStart,
    setSessionStart,
    connectionStatus,
  } = useAnalyze();
  const { handleNavigation } = useNavigationBlock();
  const [streamUrl, setStreamUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const chatContainerRef = useRef(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (autoScroll && chatContainerRef.current) {
      chatContainerRef.current.scrollToItem(messages.length - 1, "end");
    }
  }, [messages, autoScroll]);

  const handleChatScroll = (e) => {
    const { scrollHeight, scrollTop, clientHeight } = e.target;
    const bottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 100;
    setShowScrollButton(!bottom);
    setAutoScroll(bottom);
  };

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollToItem(messages.length - 1, "end");
      setAutoScroll(true);
      setShowScrollButton(false);
    }
  };

  const saveAnalysisForDisconnect = async () => {
    // Check if user is logged in
    if (!user) {
      await Swal.fire({
        title: "Login Required",
        text: "You need to be logged in to save analysis results. Please sign in to save your data.",
        icon: "warning",
        showConfirmButton: true,
        confirmButtonText: "Sign In",
        confirmButtonColor: "#9147ff",
        background: "#18181b",
        color: "#fff",
        showCancelButton: true,
        cancelButtonText: "Cancel",
        cancelButtonColor: "#6B7280",
      }).then((result) => {
        if (result.isConfirmed) {
          window.location.href = "/login";
        }
      });
      return false;
    }

    try {
      // Ensure token is valid before attempting to save
      await ensureValidToken();

      const getTopContributors = (sentimentType, limit = 5) => {
        const contributors = Object.entries(userSentiments[sentimentType])
          .map(([username, count]) => ({ username, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, limit);
        return contributors;
      };

      // Aggregate timeSeries into per-minute data by sentiment to reduce storage (99.7% reduction)
      const aggregatedTimeSeries = [];
      ["positive", "neutral", "negative"].forEach((sentiment) => {
        if (minuteSeries[sentiment]) {
          minuteSeries[sentiment].forEach((point) => {
            aggregatedTimeSeries.push({
              x: sessionStart + point.x * 60000, // Convert minute index back to timestamp
              y: point.y,
              sentiment: sentiment,
            });
          });
        }
      });

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
      const response = await fetch(`${API_URL}/api/history/save`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(analysisData),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save analysis");
      }

      // Add the new analysis to the history cache
      const newAnalysis = {
        _id: data.history_id,
        streamer_name: currentChannel,
        total_chats: messages.length,
        sentiment_count: sentimentCounts,
        top_positive: getTopContributors("positive"),
        top_negative: getTopContributors("negative"),
        top_neutral: getTopContributors("neutral"),
        duration: elapsed,
        created_at: new Date().toISOString(),
        user_id: user._id,
      };
      addAnalysis(newAnalysis);

      return true;
    } catch (error) {
      console.error("Save failed:", error);
      let errorMessage = "Failed to save analysis data";
      let showLoginButton = false;

      if (error.message) {
        errorMessage += `: ${error.message}`;
        // Check if it's an authentication error
        if (
          error.message.includes("Authentication token expired") ||
          error.message.includes("Please log in again")
        ) {
          showLoginButton = true;
        }
      }

      const swalConfig = {
        title: "Error",
        text: errorMessage,
        icon: "error",
        showConfirmButton: true,
        confirmButtonColor: "#EF4444",
        background: "#18181b",
        color: "#fff",
      };

      if (showLoginButton) {
        swalConfig.showCancelButton = true;
        swalConfig.cancelButtonText = "Cancel";
        swalConfig.confirmButtonText = "Go to Login";
        swalConfig.confirmButtonColor = "#9147ff";
      }

      const result = await Swal.fire(swalConfig);

      if (showLoginButton && result.isConfirmed) {
        window.location.href = "/login";
      }

      return false;
    }
  };

  const handleDisconnectWithConfirmation = async () => {
    const result = await NavigationConfirmationModal.showDisconnectConfirmation(
      !!user
    );

    if (!result.shouldDisconnect) {
      return; // User chose to cancel
    }

    try {
      if (result.shouldSave && user) {
        const saveSuccess = await saveAnalysisForDisconnect();
        if (saveSuccess) {
          await NavigationConfirmationModal.showSaveSuccess();
        } else {
          // Save failed or user not logged in, show error and don't disconnect
          return;
        }
      } else if (result.shouldDiscard) {
        await NavigationConfirmationModal.showDiscardMessage(!!user);
      }

      // Disconnect from analysis
      await disconnectFromChannel();
    } catch (error) {
      console.error("Disconnect error:", error);
      await NavigationConfirmationModal.showError(
        "Error",
        "Failed to process disconnect. Please try again."
      );
    }
  };

  const saveAnalysis = async () => {
    // Check if user is logged in
    if (!user) {
      await Swal.fire({
        title: "Login Required",
        text: "You need to be logged in to save analysis results. Please sign in to save your data.",
        icon: "warning",
        showConfirmButton: true,
        confirmButtonText: "Sign In",
        confirmButtonColor: "#9147ff",
        background: "#18181b",
        color: "#fff",
        showCancelButton: true,
        cancelButtonText: "Cancel",
        cancelButtonColor: "#6B7280",
      }).then((result) => {
        if (result.isConfirmed) {
          window.location.href = "/login";
        }
      });
      return false;
    }

    try {
      setIsSaving(true);

      // Ensure token is valid before attempting to save
      await ensureValidToken();

      const getTopContributors = (sentimentType, limit = 5) => {
        const contributors = Object.entries(userSentiments[sentimentType])
          .map(([username, count]) => ({ username, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, limit);
        return contributors;
      };

      // Aggregate timeSeries into per-minute data by sentiment to reduce storage (99.7% reduction)
      const aggregatedTimeSeries = [];
      ["positive", "neutral", "negative"].forEach((sentiment) => {
        if (minuteSeries[sentiment]) {
          minuteSeries[sentiment].forEach((point) => {
            aggregatedTimeSeries.push({
              x: sessionStart + point.x * 60000, // Convert minute index back to timestamp
              y: point.y,
              sentiment: sentiment,
            });
          });
        }
      });

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
      const response = await fetch(`${API_URL}/api/history/save`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(analysisData),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save analysis");
      }

      // Add the new analysis to the history cache
      const newAnalysis = {
        _id: data.history_id,
        streamer_name: currentChannel,
        total_chats: messages.length,
        sentiment_count: sentimentCounts,
        top_positive: getTopContributors("positive"),
        top_negative: getTopContributors("negative"),
        top_neutral: getTopContributors("neutral"),
        duration: elapsed,
        created_at: new Date().toISOString(),
        user_id: user._id,
      };
      addAnalysis(newAnalysis);

      await Swal.fire({
        title: "Saved!",
        text: "Analysis has been saved successfully",
        icon: "success",
        timer: 1000,
        timerProgressBar: true,
        showConfirmButton: false,
        position: "top-end",
        toast: true,
        confirmButtonColor: "#9147ff",
        background: "#18181b",
        color: "#fff",
      });
      return true;
    } catch (error) {
      console.error("Save failed:", error);
      let errorMessage = "Failed to save analysis data";
      let showLoginButton = false;

      if (error.message) {
        errorMessage += `: ${error.message}`;
        // Check if it's an authentication error
        if (
          error.message.includes("Authentication token expired") ||
          error.message.includes("Please log in again")
        ) {
          showLoginButton = true;
        }
      }

      const swalConfig = {
        title: "Error",
        text: errorMessage,
        icon: "error",
        showConfirmButton: true,
        confirmButtonColor: "#EF4444",
        background: "#18181b",
        color: "#fff",
      };

      if (showLoginButton) {
        swalConfig.showCancelButton = true;
        swalConfig.cancelButtonText = "Cancel";
        swalConfig.confirmButtonText = "Go to Login";
        swalConfig.confirmButtonColor = "#9147ff";
      }

      const result = await Swal.fire(swalConfig);

      if (showLoginButton && result.isConfirmed) {
        window.location.href = "/login";
      }

      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsAnalyzing(true);
    try {
      if (isConnected) {
        // Disconnect from current channel with confirmation
        await handleDisconnectWithConfirmation();
      } else {
        await connectToChannel(streamUrl);
      }
    } catch (error) {
      console.error("Action failed:", error);

      // Provide more specific error messages based on error type
      let errorTitle = "Connection Failed";
      let errorMessage = error.message || "Failed to connect to channel";

      if (error.message.includes("Socket connection not available")) {
        errorTitle = "Connection Error";
        errorMessage = "Unable to establish connection. Please try again.";
      } else if (error.message.includes("Invalid Twitch URL")) {
        errorTitle = "Invalid Link";
        errorMessage = "Please enter a valid Twitch channel URL.";
      } else if (error.message.includes("Failed to connect to channel")) {
        errorTitle = "Channel Connection Failed";
        errorMessage =
          "Unable to connect to the Twitch channel. Please check the URL and try again.";
      }

      Swal.fire({
        title: errorTitle,
        text: errorMessage,
        icon: "error",
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        background: "#18181b",
        color: "#fff",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const filteredMessages = useMemo(
    () => getFilteredMessages(selectedFilter),
    [getFilteredMessages, selectedFilter]
  );

  // Aggregate sentiment counts into per-minute bins since session start
  const minuteSeries = useMemo(() => {
    if (!sessionStart || !timeSeries || timeSeries.length === 0) {
      return { positive: [], neutral: [], negative: [] };
    }

    // First, count messages per sentiment per minute
    const counts = {
      positive: new Map(),
      neutral: new Map(),
      negative: new Map(),
    };

    // Track total messages per minute for percentage calculation
    const totalPerMinute = new Map();

    for (const p of timeSeries) {
      const xMs = typeof p.x === "number" ? p.x : Date.now();
      const minute = Math.floor((xMs - sessionStart) / 60000);
      const sentiment = p.sentiment || "neutral";

      if (minute >= 0 && counts[sentiment]) {
        const prevCount = counts[sentiment].get(minute) || 0;
        counts[sentiment].set(minute, prevCount + 1);

        const prevTotal = totalPerMinute.get(minute) || 0;
        totalPerMinute.set(minute, prevTotal + 1);
      }
    }

    // Convert to arrays with average sentiment proportion
    const result = {};
    const allMinutes = new Set();

    // Collect all minutes that have data
    Object.values(counts).forEach((map) => {
      map.forEach((_, minute) => allMinutes.add(minute));
    });

    // For each sentiment, calculate proportion per minute
    for (const [sentiment, countMap] of Object.entries(counts)) {
      result[sentiment] = Array.from(allMinutes)
        .sort((a, b) => a - b)
        .map((minute) => {
          const count = countMap.get(minute) || 0;
          const total = totalPerMinute.get(minute) || 1;
          // Return as proportion (0 to 1) for better visualization
          return { x: minute, y: count / total };
        });
    }

    return result;
  }, [timeSeries, sessionStart]);

  useEffect(() => {
    if (!sessionStart) return;
    setElapsed(Math.floor((Date.now() - sessionStart) / 1000));
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - sessionStart) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStart]);

  function formatElapsed(seconds) {
    const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }

  return (
    <div className="min-h-screen bg-black py-6 px-8">
      {/* Main container */}
      <div
        className={`max-w-[1400px] mx-auto space-y-6${
          isConnected ? " mt-8" : ""
        } ${isConnected ? "min-h-[80vh] flex flex-col justify-stretch" : ""}`}
      >
        {!isConnected && (
          <div className="text-center pt-6 pb-12">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-4">
              Start <span className="text-twitch">Analyzing</span>
            </h1>
            <p className="text-xl text-gray-300 mb-6 max-w-3xl mx-auto">
              Connect to a Twitch channel to begin real-time sentiment analysis.
            </p>
          </div>
        )}

        {/* Top Container - Connect to Channel */}
        {!isConnected && (
          <div className="bg-black border border-gray-700 rounded-lg p-4 shadow-lg">
            <h2 className="text-2xl font-bold text-white mb-4">
              Connect to Channel
            </h2>
            <p className="text-gray-300 mb-4">
              Enter a Twitch channel URL to start analyzing chat
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="streamUrl"
                  className="block text-base font-medium text-gray-300 mb-2"
                >
                  Twitch Channel URL
                </label>
                <input
                  type="url"
                  id="streamUrl"
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                  placeholder="https://twitch.tv/channelname"
                  required={!isConnected}
                  disabled={isConnected}
                  className="w-full px-4 py-3 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-twitch disabled:opacity-50"
                />
                <p className="text-sm text-gray-400 mt-1">
                  Format: https://www.twitch.tv/channelname
                </p>
              </div>

              <button
                type="submit"
                disabled={isAnalyzing}
                className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center ${
                  isAnalyzing
                    ? "bg-gray-600 cursor-not-allowed"
                    : "bg-twitch hover:bg-twitch-dark text-white cursor-pointer"
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>Connecting...</span>
                  </>
                ) : (
                  "Connect and Analyze"
                )}
              </button>
            </form>
          </div>
        )}

        {/* Bottom Container*/}
        {isConnected && (
          <div className="space-y-6">
            {/* Time Series - Sentiment Distribution Over Time */}

            <div className="bg-black border border-gray-700 rounded-lg p-6 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                  <svg
                    className="w-6 h-6 text-twitch"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3 3v18h18M4 16l4-4 3 3 5-6 4 5"
                    />
                  </svg>
                  Sentiment Distribution Over Time
                </h2>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                Proportion of each sentiment per minute (0 to 100%)
              </p>

              {minuteSeries.positive?.length > 0 ||
              minuteSeries.neutral?.length > 0 ||
              minuteSeries.negative?.length > 0 ? (
                <div className="h-[260px] relative">
                  <Line
                    data={{
                      datasets: [
                        {
                          label: "Positive Sentiment",
                          data: minuteSeries.positive || [],
                          parsing: false,
                          borderColor: "#22c55e",
                          backgroundColor: "rgba(34, 197, 94, 0.1)",
                          pointRadius: 1.5,
                          borderWidth: 2,
                          tension: 0.2,
                          fill: true,
                        },
                        {
                          label: "Neutral Sentiment",
                          data: minuteSeries.neutral || [],
                          parsing: false,
                          borderColor: "#fde047",
                          backgroundColor: "rgba(253, 224, 71, 0.1)",
                          pointRadius: 1.5,
                          borderWidth: 2,
                          tension: 0.2,
                          fill: true,
                        },
                        {
                          label: "Negative Sentiment",
                          data: minuteSeries.negative || [],
                          parsing: false,
                          borderColor: "#ef4444",
                          backgroundColor: "rgba(239, 68, 68, 0.1)",
                          pointRadius: 1.5,
                          borderWidth: 2,
                          tension: 0.2,
                          fill: true,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false,
                        },
                        tooltip: {
                          callbacks: {
                            title: (items) => {
                              const min = items?.[0]?.raw?.x ?? 0;
                              return `Minute ${min} (${formatElapsed(
                                min * 60
                              )})`;
                            },
                            label: (ctx) =>
                              `${ctx.dataset.label}: ${(
                                (ctx.raw?.y ?? 0) * 100
                              ).toFixed(1)}%`,
                          },
                        },
                      },
                      scales: {
                        x: {
                          type: "linear",
                          ticks: {
                            color: "#D1D5DB",
                            stepSize: 1,
                            callback: (v) => `${v}m`,
                          },
                          grid: { color: "#374151" },
                        },
                        y: {
                          min: 0,
                          max: 1,
                          ticks: {
                            stepSize: 0.2,
                            color: "#D1D5DB",
                            callback: (v) => `${(v * 100).toFixed(0)}%`,
                          },
                          grid: { color: "#374151" },
                        },
                      },
                    }}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <svg
                    className="w-12 h-12 text-gray-600 mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                      d="M3 3v18h18M4 16l4-4 3 3 5-6 4 5"
                    />
                  </svg>
                  <p className="text-gray-400 mb-1">No time series data yet</p>
                  <p className="text-gray-500 text-sm">
                    Start analyzing to see confidence over time
                  </p>
                </div>
              )}
            </div>
            {/* Top Row - Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 space-y-6">
                {/* Overall Sentiment Analysis */}
                <div className="bg-black border border-gray-700 rounded-lg p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xl font-bold text-white flex items-center gap-3">
                      <svg
                        className="w-6 h-6 text-twitch"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                        />
                      </svg>
                      Overall Sentiment Analysis
                    </h2>
                    {isConnected && (
                      <span className="ml-3 px-3 py-1 rounded-full bg-gray-800 text-gray-300 text-sm font-medium border border-gray-700">
                        {formatElapsed(elapsed)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mb-4">
                    Real-time sentiment breakdown of chat messages
                  </p>

                  {isConnected && messages.length > 0 ? (
                    <div className="h-[250px] relative">
                      <SentimentPieChart sentimentCounts={sentimentCounts} />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <svg
                        className="w-12 h-12 text-gray-600 mb-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.5"
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                        />
                      </svg>
                      <p className="text-gray-400 mb-1">
                        No sentiment data available
                      </p>
                      <p className="text-gray-500 text-sm">
                        Connect to a channel to see analytics
                      </p>
                    </div>
                  )}
                </div>

                {/* Top Chatters Analysis */}
                <div className="bg-black border border-gray-700 rounded-lg p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xl font-bold text-white flex items-center gap-3">
                      <svg
                        className="w-6 h-6 text-twitch"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                      Top Chatters Analysis
                    </h2>
                    {isConnected && messages.length > 0 && (
                      <span className="ml-3 px-3 py-1 rounded-full bg-gray-800 text-gray-300 text-sm font-medium border border-gray-700">
                        {formatNumber(messages.length)} messages
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mb-4">
                    Users with most messages by sentiment
                  </p>

                  {isConnected && messages.length > 0 ? (
                    <div className="flex flex-col md:flex-row gap-4 h-full">
                      {/* Positive */}
                      <div className="flex-1 bg-black border border-gray-700 rounded p-2 min-w-0 h-full flex flex-col overflow-y-auto max-h-72">
                        <h3 className="text-green-400 font-semibold text-center mb-2">
                          Positive
                        </h3>
                        {Object.entries(userSentiments.positive || {})
                          .sort(([, a], [, b]) => b - a)
                          .slice(0, 5)
                          .map(([username, count], idx) => (
                            <div
                              key={username}
                              className="flex justify-between items-center py-1 px-2 rounded hover:bg-gray-900/10"
                            >
                              <span className="truncate text-twitch">
                                {username}
                              </span>
                              <span className="text-green-400 font-medium">
                                {formatNumber(count)}
                              </span>
                            </div>
                          ))}
                        {Object.keys(userSentiments.positive || {}).length ===
                          0 && (
                          <div className="text-gray-400 text-center py-2">
                            No data
                          </div>
                        )}
                      </div>
                      {/* Neutral */}
                      <div className="flex-1 bg-black border border-gray-700 rounded p-2 min-w-0 h-full flex flex-col overflow-y-auto max-h-72">
                        <h3 className="text-yellow-400 font-semibold text-center mb-2">
                          Neutral
                        </h3>
                        {Object.entries(userSentiments.neutral || {})
                          .sort(([, a], [, b]) => b - a)
                          .slice(0, 5)
                          .map(([username, count], idx) => (
                            <div
                              key={username}
                              className="flex justify-between items-center py-1 px-2 rounded hover:bg-gray-900/10"
                            >
                              <span className="truncate text-twitch">
                                {username}
                              </span>
                              <span className="text-yellow-400 font-medium">
                                {formatNumber(count)}
                              </span>
                            </div>
                          ))}
                        {Object.keys(userSentiments.neutral || {}).length ===
                          0 && (
                          <div className="text-yellow-400 text-center py-2">
                            No data
                          </div>
                        )}
                      </div>
                      {/* Negative */}
                      <div className="flex-1 bg-black border border-gray-700 rounded p-2 min-w-0 h-full flex flex-col overflow-y-auto max-h-72">
                        <h3 className="text-red-400 font-semibold text-center mb-2">
                          Negative
                        </h3>
                        {Object.entries(userSentiments.negative || {})
                          .sort(([, a], [, b]) => b - a)
                          .slice(0, 5)
                          .map(([username, count], idx) => (
                            <div
                              key={username}
                              className="flex justify-between items-center py-1 px-2 rounded hover:bg-gray-900/10"
                            >
                              <span className="truncate text-twitch">
                                {username}
                              </span>
                              <span className="text-red-400 font-medium">
                                {formatNumber(count)}
                              </span>
                            </div>
                          ))}
                        {Object.keys(userSentiments.negative || {}).length ===
                          0 && (
                          <div className="text-gray-400 text-center py-2">
                            No data
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <svg
                        className="w-12 h-12 text-gray-600 mb-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.5"
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                      <p className="text-gray-400 mb-1">
                        No user data available
                      </p>
                      <p className="text-gray-500 text-sm">
                        Connect to a channel to see analytics
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Chat Container */}
              <div className="lg:col-span-8">
                <div className="bg-black border border-gray-700 rounded-lg p-6 shadow-lg h-full min-h-[600px] relative">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
                    <div className="flex bg-gray-900 rounded-lg p-1 w-full sm:w-auto justify-center sm:justify-start mb-2 sm:mb-0">
                      {["All", "Positive", "Neutral", "Negative"].map(
                        (filter) => (
                          <button
                            key={filter}
                            onClick={() => setSelectedFilter(filter)}
                            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                              selectedFilter === filter
                                ? "bg-twitch text-white"
                                : "text-gray-400 hover:text-twitch hover:bg-gray-900"
                            }`}
                          >
                            {filter}
                          </button>
                        )
                      )}
                    </div>
                    {isConnected && (
                      <button
                        onClick={async () => {
                          setIsDisconnecting(true);
                          try {
                            await handleDisconnectWithConfirmation();
                          } finally {
                            setIsDisconnecting(false);
                          }
                        }}
                        className="px-4 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors shadow disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto cursor-pointer"
                        disabled={isDisconnecting}
                      >
                        {isDisconnecting ? "Disconnecting..." : "Disconnect"}
                      </button>
                    )}
                  </div>

                  {isConnected && messages.length > 0 ? (
                    <div className="h-[600px]">
                      <List
                        height={600}
                        itemCount={filteredMessages.length}
                        itemSize={64}
                        width={"100%"}
                        itemData={filteredMessages}
                        ref={chatContainerRef}
                        onScroll={({
                          scrollOffset,
                          scrollUpdateWasRequested,
                        }) => {
                          if (!scrollUpdateWasRequested) {
                            const atBottom =
                              scrollOffset >=
                              filteredMessages.length * 64 - 600 - 10;
                            setAutoScroll(atBottom);
                            setShowScrollButton(!atBottom);
                          }
                        }}
                      >
                        {ChatRow}
                      </List>
                    </div>
                  ) : (
                    <div className="h-[600px] flex items-center justify-center">
                      <div className="text-center">
                        <svg
                          className="w-16 h-16 text-gray-600 mb-4 mx-auto"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.5"
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                          />
                        </svg>
                        <h3 className="text-xl text-gray-400 font-medium mb-2">
                          No Active Chat
                        </h3>
                        <p className="text-gray-500">
                          Connect to a Twitch channel to start viewing
                        </p>
                      </div>
                    </div>
                  )}

                  {showScrollButton && (
                    <button
                      onClick={scrollToBottom}
                      className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-twitch hover:bg-twitch-dark text-white rounded-full p-3 shadow-lg transition-all duration-200 hover:scale-105 z-10 cursor-pointer"
                      title="Scroll to Bottom"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Word Cloud Analysis - Full Width Below Chat */}
            <div className="bg-black border border-gray-700 rounded-lg p-6 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <svg
                      className="w-6 h-6 text-twitch"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                      />
                    </svg>
                    Word Cloud Analysis
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">
                    Most frequent words by sentiment - Updated in real-time
                  </p>
                </div>
                {/* Message count and Live Analysis badge removed */}
              </div>

              {isConnected && messages.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Positive Words */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-green-400 rounded-full"></span>
                      <h3 className="text-green-400 font-semibold text-lg">
                        Positive Words
                      </h3>
                      <span className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">
                        {getTopWords("positive", 15).length} words
                      </span>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                      <WordCloud
                        words={getTopWords("positive", 15)}
                        sentiment="positive"
                        maxWords={15}
                      />
                    </div>
                  </div>

                  {/* Neutral Words */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-yellow-400 rounded-full"></span>
                      <h3 className="text-yellow-400 font-semibold text-lg">
                        Neutral Words
                      </h3>
                      <span className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">
                        {getTopWords("neutral", 15).length} words
                      </span>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                      <WordCloud
                        words={getTopWords("neutral", 15)}
                        sentiment="neutral"
                        maxWords={15}
                      />
                    </div>
                  </div>

                  {/* Negative Words */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-red-400 rounded-full"></span>
                      <h3 className="text-red-400 font-semibold text-lg">
                        Negative Words
                      </h3>
                      <span className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">
                        {getTopWords("negative", 15).length} words
                      </span>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                      <WordCloud
                        words={getTopWords("negative", 15)}
                        sentiment="negative"
                        maxWords={15}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="bg-gray-900/50 rounded-full p-6 mb-4">
                    <svg
                      className="w-16 h-16 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl text-gray-400 font-medium mb-2">
                    No Word Data Available
                  </h3>
                  <p className="text-gray-500 max-w-md">
                    Connect to a Twitch channel to start analyzing chat messages
                    and see the most frequent words by sentiment.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status Indicator - Far Bottom Right, Outside Container */}
      <div className="fixed bottom-6 right-6 z-50 hidden sm:block">
        <span className="flex items-center gap-2 px-4 py-1 rounded-full font-semibold text-sm shadow-lg bg-gray-900/90 text-white border border-white/10">
          {/* Status Indicator Dot */}
          <span
            className={`inline-block w-3 h-3 rounded-full ${
              connectionStatus === "connected"
                ? "bg-green-400"
                : connectionStatus === "connecting" ||
                  connectionStatus === "reconnecting"
                ? "bg-yellow-400 animate-pulse"
                : "bg-red-400"
            }`}
          ></span>

          {/* Status Text */}
          {connectionStatus === "connected" ? (
            <>
              Connected: <span className="text-twitch">{currentChannel}</span>
            </>
          ) : connectionStatus === "connecting" ? (
            <span className="flex items-center gap-1">
              <svg
                className="w-3 h-3 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Connecting...
            </span>
          ) : connectionStatus === "reconnecting" ? (
            <span className="flex items-center gap-1">
              <svg
                className="w-3 h-3 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Reconnecting...
            </span>
          ) : connectionStatus === "error" || connectionStatus === "failed" ? (
            "Connection Error"
          ) : (
            "Disconnected"
          )}
        </span>
      </div>

      {/* Connection Status Modal */}
      <ConnectionStatusModal
        isAnalyzing={isAnalyzing}
        isSaving={isSaving}
        onSaveAnalysis={saveAnalysis}
        onDiscardAnalysis={() => {
          setIsAnalyzing(false);
          disconnectFromChannel();
          setSessionStart(null);
          setElapsed(0);
        }}
        analysisData={{
          streamer_name: currentChannel,
          total_chats: messages.length,
          sentiment_count: sentimentCounts,
          top_positive: Object.entries(userSentiments.positive)
            .map(([username, count]) => ({ username, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5),
          top_negative: Object.entries(userSentiments.negative)
            .map(([username, count]) => ({ username, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5),
          top_neutral: Object.entries(userSentiments.neutral)
            .map(([username, count]) => ({ username, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5),
          duration: elapsed,
        }}
      />
    </div>
  );
};

export default Analyze;
