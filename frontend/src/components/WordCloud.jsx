import React, { useMemo, useCallback, memo } from "react";

// Memoized WordItem component to prevent unnecessary re-renders
const WordItem = memo(({ word, color, position, index, total }) => {
  // Calculate rotation once per word
  const rotation = useMemo(() => (Math.random() - 0.5) * 25, []);
  
  // Memoize style object to prevent recreation on every render
  const style = useMemo(() => ({
    fontSize: `${word.fontSize}px`,
    color,
    opacity: word.opacity,
    top: position.top,
    left: position.left,
    transform: `rotate(${rotation}deg)`,
    textShadow: `0 2px 4px rgba(0, 0, 0, 0.8), 0 0 8px ${color}40`,
    zIndex: total - index,
    filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))",
    willChange: 'transform, opacity',
    backfaceVisibility: 'hidden',
    transformStyle: 'preserve-3d',
    transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
  }), [word, color, position, rotation, index, total]);

  return (
    <span
      className="absolute font-semibold cursor-pointer hover:scale-110 hover:z-50"
      style={style}
      title={`"${word.word}" appears ${word.count} times`}
    >
      {word.word}
    </span>
  );
}, (prevProps, nextProps) => {
  // Only re-render if word data or position changes
  return (
    prevProps.word.word === nextProps.word.word &&
    prevProps.word.count === nextProps.word.count &&
    prevProps.word.fontSize === nextProps.word.fontSize &&
    prevProps.word.opacity === nextProps.word.opacity &&
    prevProps.color === nextProps.color &&
    prevProps.position.top === nextProps.position.top &&
    prevProps.position.left === nextProps.position.left &&
    prevProps.index === nextProps.index &&
    prevProps.total === nextProps.total
  );
});

// Static positions array to prevent recreation on every render
const WORD_POSITIONS = [
  { top: "10%", left: "15%" },
  { top: "20%", left: "60%" },
  { top: "35%", left: "25%" },
  { top: "45%", left: "75%" },
  { top: "60%", left: "10%" },
  { top: "70%", left: "50%" },
  { top: "15%", left: "40%" },
  { top: "30%", left: "80%" },
  { top: "50%", left: "5%" },
  { top: "65%", left: "35%" },
  { top: "80%", left: "70%" },
  { top: "25%", left: "90%" },
  { top: "40%", left: "45%" },
  { top: "55%", left: "20%" },
  { top: "75%", left: "85%" },
];

// Sentiment color map
const SENTIMENT_COLORS = {
  positive: "#22c55e",
  negative: "#ef4444",
  neutral: "#fde047",
  default: "#6b7280"
};

const WordCloud = memo(({ words = [], sentiment = 'neutral', maxWords = 15 }) => {
  // Memoize processed words to prevent recalculation on every render
  const processedWords = useMemo(() => {
    if (!words || words.length === 0) return [];

    const wordList = words.slice(0, maxWords);
    const counts = wordList.map(w => w.count);
    const maxCount = Math.max(...counts);
    const minCount = Math.min(...counts);
    const countRange = Math.max(1, maxCount - minCount);

    return wordList.map(word => ({
      ...word,
      fontSize: Math.round(12 + ((word.count - minCount) / countRange) * 20),
      opacity: 0.6 + ((word.count - minCount) / countRange) * 0.4
    }));
  }, [words, maxWords]);

  // Memoize the color based on sentiment
  const color = useMemo(() => 
    SENTIMENT_COLORS[sentiment] || SENTIMENT_COLORS.default
  , [sentiment]);

  // Memoize the position getter
  const getPosition = useCallback((index) => 
    WORD_POSITIONS[index % WORD_POSITIONS.length],
    []
  );

  // Early return for empty state
  if (!processedWords.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
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
            d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
          />
        </svg>
        <p className="text-gray-400 mb-1">No words to display</p>
        <p className="text-gray-500 text-sm">
          Words will appear as chat messages are analyzed
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-80 w-full overflow-hidden rounded-lg bg-gradient-to-br from-gray-900/80 to-gray-800/60 border border-gray-600/50 p-6">
      <div className="absolute inset-0">
        {processedWords.map((word, index) => (
          <WordItem 
            key={`${word.word}-${index}`}
            word={word}
            color={color}
            position={getPosition(index)}
            index={index}
            total={processedWords.length}
          />
        ))}
      </div>
      
      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-gray-900/30 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-gray-900/20 via-transparent to-transparent pointer-events-none" />
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if words or sentiment changes
  return (
    prevProps.words === nextProps.words &&
    prevProps.sentiment === nextProps.sentiment &&
    prevProps.maxWords === nextProps.maxWords
  );
});

// Add display name for better debugging
WordCloud.displayName = 'WordCloud';
WordItem.displayName = 'WordItem';

export default WordCloud;