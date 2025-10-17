import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { useAuth } from "./AuthContext";
import { useWebSocketConnection } from "../hooks/useWebSocketConnection";

const API_URL = import.meta.env.VITE_API_URL;

const AnalyzeContext = createContext();

export const useAnalyze = () => useContext(AnalyzeContext);

export const AnalyzeProvider = ({ children }) => {
  const { user } = useAuth();
  const {
    websocket,
    isConnected: wsConnected,
    connectionStatus,
    connect: connectWS,
    disconnect: disconnectWS,
  } = useWebSocketConnection();
  const [isConnected, setIsConnected] = useState(false);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sentimentCounts, setSentimentCounts] = useState({
    positive: 0,
    neutral: 0,
    negative: 0,
  });
  const [userSentiments, setUserSentiments] = useState({
    positive: {},
    neutral: {},
    negative: {},
  });
  const [wordFrequencies, setWordFrequencies] = useState({
    positive: {},
    neutral: {},
    negative: {},
  });
  const [timeSeries, setTimeSeries] = useState([]); // [{ x: msEpoch, y: confidence }]
  const processedMessages = useRef(new Set());
  const [sessionStart, setSessionStart] = useState(null);
  const sessionStartRef = useRef(null);

  // Word processing utilities
  const processWords = useCallback((text, sentiment) => {
    if (!text || !sentiment) return;

    // Common stop words to filter out
    const stopWords = new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "being",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "must",
      "can",
      "this",
      "that",
      "these",
      "those",
      "i",
      "you",
      "he",
      "she",
      "it",
      "we",
      "they",
      "me",
      "him",
      "her",
      "us",
      "them",
      "my",
      "your",
      "his",
      "her",
      "its",
      "our",
      "their",
      "mine",
      "yours",
      "hers",
      "ours",
      "theirs",
      "am",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "being",
      "have",
      "has",
      "had",
      "having",
      "do",
      "does",
      "did",
      "doing",
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "must",
      "can",
      "shall",
      "ought",
      "need",
      "dare",
      "used",
      "go",
      "goes",
      "went",
      "gone",
      "going",
      "come",
      "comes",
      "came",
      "coming",
      "get",
      "gets",
      "got",
      "gotten",
      "getting",
      "make",
      "makes",
      "made",
      "making",
      "take",
      "takes",
      "took",
      "taken",
      "taking",
      "see",
      "sees",
      "saw",
      "seen",
      "seeing",
      "know",
      "knows",
      "knew",
      "known",
      "knowing",
      "think",
      "thinks",
      "thought",
      "thinking",
      "look",
      "looks",
      "looked",
      "looking",
      "want",
      "wants",
      "wanted",
      "wanting",
      "give",
      "gives",
      "gave",
      "given",
      "giving",
      "use",
      "uses",
      "used",
      "using",
      "find",
      "finds",
      "found",
      "finding",
      "tell",
      "tells",
      "told",
      "telling",
      "ask",
      "asks",
      "asked",
      "asking",
      "work",
      "works",
      "worked",
      "working",
      "seem",
      "seems",
      "seemed",
      "seeming",
      "feel",
      "feels",
      "felt",
      "feeling",
      "try",
      "tries",
      "tried",
      "trying",
      "leave",
      "leaves",
      "left",
      "leaving",
      "call",
      "calls",
      "called",
      "calling",
      "lol",
      "lmao",
      "omg",
      "wtf",
      "fuck",
      "shit",
      "damn",
      "hell",
      "yeah",
      "yes",
      "no",
      "ok",
      "okay",
      "hi",
      "hello",
      "hey",
      "thanks",
      "thank",
      "please",
      "sorry",
      "sure",
      "nice",
      "good",
      "bad",
      "great",
      "awesome",
      "cool",
      "amazing",
      "love",
      "hate",
      "like",
      "dislike",
      "funny",
      "haha",
      "hahaha",
    ]);

    // Clean and extract words
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ") // Remove punctuation
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word)) // Filter short words and stop words
      .filter((word) => !/^\d+$/.test(word)); // Filter pure numbers

    return words;
  }, []);

  // Process incoming messages and update state
  const processMessage = useCallback((msg) => {
    const messageId = `${msg.username}-${msg.message}`;
    if (!processedMessages.current.has(messageId)) {
      processedMessages.current.add(messageId);

      setMessages((prev) => [...prev, msg]);

      // Use functional updates to avoid stale closure issues
      // Only process sentiment if it exists
      if (msg.sentiment) {
        setSentimentCounts((prev) => ({
          ...prev,
          [msg.sentiment]: (prev[msg.sentiment] || 0) + 1,
        }));

        setUserSentiments((prev) => {
          const updated = { ...prev };
          if (!updated[msg.sentiment]) {
            updated[msg.sentiment] = {};
          }
          updated[msg.sentiment] = {
            ...updated[msg.sentiment],
            [msg.username]: (updated[msg.sentiment][msg.username] || 0) + 1,
          };
          return updated;
        });

        // Process words for word frequency analysis
        const words = processWords(msg.message, msg.sentiment);
        if (words && words.length > 0) {
          setWordFrequencies((prev) => {
            const updated = { ...prev };
            if (!updated[msg.sentiment]) {
              updated[msg.sentiment] = {};
            }

            words.forEach((word) => {
              updated[msg.sentiment][word] =
                (updated[msg.sentiment][word] || 0) + 1;
            });

            return updated;
          });
        }

        // Append to time series for line chart (x: timestamp ms, y: confidence 0-1, sentiment: type)
        const rawTs = msg.timestamp;
        const tsMs = rawTs ? Date.parse(rawTs) : Date.now();
        const y = typeof msg.confidence === "number" ? msg.confidence : 0;
        if (!Number.isNaN(tsMs)) {
          setTimeSeries((prev) => [
            ...prev,
            {
              x: tsMs,
              y,
              sentiment: msg.sentiment,
            },
          ]);
        }
      }
    }
  }, []); // Remove dependencies to avoid stale closures

  // WebSocket connection management
  const connectToChannel = useCallback(
    async (streamUrl) => {
      // Allow both authenticated and non-authenticated users to connect

      // Cleanup previous WebSocket connection
      disconnectWS();

      setMessages([]);
      setSentimentCounts({ positive: 0, neutral: 0, negative: 0 });
      setUserSentiments({ positive: {}, neutral: {}, negative: {} });
      setTimeSeries([]);

      const headers = {
        "Content-Type": "application/json",
      };

      // Only add authorization header if user is logged in
      const token = localStorage.getItem("token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Use different endpoints based on authentication status
      const endpoint = user
        ? "/api/twitch/connect"
        : "/api/twitch/connect-guest";

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ url: streamUrl }),
      });

      if (!response.ok) throw new Error("Failed to connect to channel");
      const data = await response.json();
      setIsConnected(true);
      setCurrentChannel(data.channel);

      if (!sessionStartRef.current) {
        const now = Date.now();
        setSessionStart(now);
        sessionStartRef.current = now;
      }

      // Log the start of the analysis if the user is authenticated
      if (user && token) {
        try {
          const logResponse = await fetch(`${API_URL}/api/log/analysis-start`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ streamer: data.channel }),
          });

          if (!logResponse.ok) {
            // Failed to log analysis start (non-critical)
          }
        } catch (e) {
          // Error logging analysis start (non-critical)
          // Don't throw error as this is not critical for the main functionality
        }
      }

      // Setup WebSocket connection for the channel
      const wsConnection = connectWS(data.channel);

      if (wsConnection) {
        // Handle WebSocket messages
        wsConnection.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === "message") {
              processMessage(data.data);
            } else if (data.type === "disconnect") {
              setIsConnected(false);
              setCurrentChannel(null);
              setMessages([]);
              setSentimentCounts({ positive: 0, neutral: 0, negative: 0 });
              setUserSentiments({ positive: {}, neutral: {}, negative: {} });
              setWordFrequencies({ positive: {}, neutral: {}, negative: {} });
              processedMessages.current.clear();
              setTimeSeries([]);
            }
          } catch (error) {
            console.error("Error processing WebSocket message:", error);
          }
        };
      }
    },
    [user, processMessage, connectWS, disconnectWS]
  );

  const disconnectFromChannel = useCallback(async () => {
    if (currentChannel) {
      try {
        const headers = {
          "Content-Type": "application/json",
        };

        // Only add authorization header if user is logged in
        const token = localStorage.getItem("token");
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        // Use different endpoints based on authentication status
        const endpoint = user
          ? "/api/twitch/disconnect"
          : "/api/twitch/disconnect-guest";

        await fetch(`${API_URL}${endpoint}`, {
          method: "POST",
          headers,
          body: JSON.stringify({ channel: currentChannel }),
        });
      } catch (e) {
        console.error("Error disconnecting from channel", e);
      }
    }

    // Disconnect WebSocket connection
    disconnectWS();

    setIsConnected(false);
    setCurrentChannel(null);
    setMessages([]);
    setSentimentCounts({ positive: 0, neutral: 0, negative: 0 });
    setUserSentiments({ positive: {}, neutral: {}, negative: {} });
    setWordFrequencies({ positive: {}, neutral: {}, negative: {} });
    processedMessages.current.clear();
    setTimeSeries([]);

    setSessionStart(null);
    sessionStartRef.current = null;
  }, [currentChannel, disconnectWS]);

  useEffect(() => {
    return () => {
      // Cleanup WebSocket connection on unmount
      disconnectWS();
    };
  }, [disconnectWS]);

  const topUsers = useMemo(() => {
    const sentiments = ["positive", "neutral", "negative"];
    const result = {};
    sentiments.forEach((sentiment) => {
      const entries = Object.entries(userSentiments[sentiment] || {});
      if (entries.length === 0) {
        result[sentiment] = ["-", 0];
      } else {
        result[sentiment] = entries.sort(([, a], [, b]) => b - a)[0];
      }
    });
    return result;
  }, [userSentiments]);

  const getFilteredMessages = useCallback(
    (selectedFilter) => {
      if (selectedFilter === "All") return messages;
      return messages.filter(
        (msg) =>
          msg.sentiment &&
          msg.sentiment.toLowerCase() === selectedFilter.toLowerCase()
      );
    },
    [messages]
  );

  // Get top words for each sentiment
  const getTopWords = useCallback(
    (sentiment, limit = 20) => {
      const words = wordFrequencies[sentiment] || {};
      return Object.entries(words)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([word, count]) => ({ word, count }));
    },
    [wordFrequencies]
  );

  // Get all top words for word cloud
  const getAllTopWords = useCallback(
    (limit = 15) => {
      const sentiments = ["positive", "neutral", "negative"];
      const result = {};
      sentiments.forEach((sentiment) => {
        result[sentiment] = getTopWords(sentiment, limit);
      });
      return result;
    },
    [getTopWords]
  );

  return (
    <AnalyzeContext.Provider
      value={{
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
        wsConnected,
        connectionStatus,
        // Add analysis state for navigation blocking
        isAnalyzing: isConnected,
        hasAnalysisData:
          messages.length > 0 ||
          Object.values(sentimentCounts).some((count) => count > 0),
        // Add methods to check if analysis is running in background
        isAnalysisRunning: isConnected && currentChannel !== null,
      }}
    >
      {children}
    </AnalyzeContext.Provider>
  );
};
