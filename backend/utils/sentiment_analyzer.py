from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import warnings
import re

# Import Twitch slang configuration
try:
    from .twitch_slang_config import get_all_patterns
except ImportError:
    # Fallback if config file is not available
    def get_all_patterns():
        return {}

warnings.filterwarnings('ignore')

class SentimentAnalyzer:
    def __init__(self):
        # Initialize VADER sentiment analyzer
        self.analyzer = SentimentIntensityAnalyzer()
        
        # Load Twitch-specific slang patterns from config
        self.twitch_patterns = get_all_patterns()
        
        # Log loaded patterns for debugging
        print(f"Loaded {len(self.twitch_patterns)} Twitch slang patterns")

    def detect_twitch_slang(self, text):
        """
        Detect Twitch-specific slang and return sentiment if found.
        Returns (sentiment, confidence, matched_patterns) or None if no strong match.
        """
        text_lower = text.lower()
        matched_patterns = []
        total_confidence = 0
        sentiment_scores = {'positive': 0, 'negative': 0, 'neutral': 0}
        
        # Check each pattern
        for pattern_name, pattern_data in self.twitch_patterns.items():
            matches = re.findall(pattern_data['pattern'], text, re.IGNORECASE)
            if matches:
                match_count = len(matches)
                confidence = pattern_data['confidence']
                sentiment = pattern_data['sentiment']
                
                # Weight by number of matches (spam has more weight)
                weighted_confidence = confidence * match_count
                sentiment_scores[sentiment] += weighted_confidence
                total_confidence += weighted_confidence
                
                matched_patterns.append({
                    'name': pattern_name,
                    'matches': matches,
                    'count': match_count,
                    'sentiment': sentiment,
                    'description': pattern_data['description']
                })
        
        # If we found Twitch slang patterns
        if matched_patterns and total_confidence > 0:
            # Determine dominant sentiment
            dominant_sentiment = max(sentiment_scores.items(), key=lambda x: x[1])
            
            # Only override if confidence is high enough (threshold)
            if dominant_sentiment[1] > 0.7:
                final_confidence = min(dominant_sentiment[1] / total_confidence, 0.99)
                return (dominant_sentiment[0], final_confidence, matched_patterns)
        
        return None

    def analyze_text(self, text):
        try:
            # Skip empty or very short text
            if len(text.strip()) < 2:
                return {
                    'sentiment': 'neutral',
                    'confidence': 0.0,
                    'text': text,
                    'method': 'empty'
                }
            
            # ALWAYS run both methods for better accuracy
            # 1. Check for Twitch-specific slang
            twitch_result = self.detect_twitch_slang(text)
            
            # 2. ALWAYS run VADER for sentiment analysis
            vader_scores = self.analyzer.polarity_scores(text)
            # VADER returns: {'neg': 0.0, 'neu': 0.0, 'pos': 0.0, 'compound': 0.0}
            # compound score ranges from -1 (most negative) to +1 (most positive)
            
            # Convert VADER compound score to sentiment and confidence
            compound = vader_scores['compound']
            if compound >= 0.05:
                vader_sentiment = 'positive'
                vader_confidence = min(abs(compound), 0.99)
            elif compound <= -0.05:
                vader_sentiment = 'negative'
                vader_confidence = min(abs(compound), 0.99)
            else:
                vader_sentiment = 'neutral'
                vader_confidence = 1.0 - abs(compound)
            
            # If no Twitch slang detected, trust VADER completely
            if not twitch_result:
                return {
                    'sentiment': vader_sentiment,
                    'confidence': vader_confidence,
                    'text': text,
                    'method': 'vader',
                    'vader_scores': vader_scores
                }
            
            # Both methods ran - now combine intelligently
            slang_sentiment, slang_confidence, matched_patterns = twitch_result
            
            # Count words to determine message complexity
            word_count = len(text.split())
            
            # === INTELLIGENT WEIGHTING LOGIC ===
            
            # Case 1: Very short messages (1-2 words) - trust slang more
            if word_count <= 2:
                # Pure emote/slang - use slang detection
                return {
                    'sentiment': slang_sentiment,
                    'confidence': slang_confidence,
                    'text': text,
                    'method': 'slang_short_message',
                    'matched_patterns': matched_patterns,
                    'vader_sentiment': vader_sentiment,
                    'vader_confidence': vader_confidence,
                    'vader_scores': vader_scores
                }
            
            # Case 2: Sentiments AGREE - boost confidence
            if slang_sentiment == vader_sentiment:
                # Both methods agree, high confidence
                combined_confidence = min((slang_confidence + vader_confidence) / 2 * 1.15, 0.99)
                return {
                    'sentiment': vader_sentiment,
                    'confidence': combined_confidence,
                    'text': text,
                    'method': 'hybrid_agreement',
                    'matched_patterns': matched_patterns,
                    'vader_confidence': vader_confidence,
                    'vader_scores': vader_scores,
                    'slang_confidence': slang_confidence
                }
            
            # Case 3: Sentiments DISAGREE - need smart resolution
            # This is where "I hate you lol" gets handled correctly
            
            # Check if VADER has strong conviction
            vader_strong = vader_confidence > 0.75
            slang_strong = slang_confidence > 0.85
            
            # Sub-case 3a: Short message (3-5 words) with strong slang
            if word_count <= 5 and slang_strong and not vader_strong:
                # Likely emote-heavy message, lean towards slang
                # But reduce confidence due to disagreement
                confidence = slang_confidence * 0.7
                return {
                    'sentiment': slang_sentiment,
                    'confidence': confidence,
                    'text': text,
                    'method': 'hybrid_slang_weighted',
                    'matched_patterns': matched_patterns,
                    'vader_sentiment': vader_sentiment,
                    'vader_confidence': vader_confidence,
                    'vader_scores': vader_scores
                }
            
            # Sub-case 3b: VADER has strong conviction (likely sarcasm/toxicity)
            # Example: "I hate you lol" - VADER sees "hate" strongly
            if vader_strong:
                # Trust VADER's context understanding
                # This handles: toxic message + laughing emote = still toxic
                return {
                    'sentiment': vader_sentiment,
                    'confidence': vader_confidence * 0.95,  # Slight reduction for disagreement
                    'text': text,
                    'method': 'hybrid_vader_strong',
                    'matched_patterns': matched_patterns,
                    'vader_scores': vader_scores,
                    'slang_sentiment': slang_sentiment,
                    'slang_confidence': slang_confidence
                }
            
            # Sub-case 3c: Both weak or medium - weighted average
            # Weight VADER more for longer messages
            vader_weight = min(0.5 + (word_count * 0.05), 0.8)  # 50%-80% based on length
            slang_weight = 1 - vader_weight
            
            # Calculate weighted confidence for each sentiment
            sentiment_scores = {
                'positive': 0.0,
                'neutral': 0.0,
                'negative': 0.0
            }
            
            sentiment_scores[vader_sentiment] += vader_confidence * vader_weight
            sentiment_scores[slang_sentiment] += slang_confidence * slang_weight
            
            # Pick the highest weighted score
            final_sentiment = max(sentiment_scores.items(), key=lambda x: x[1])[0]
            final_confidence = sentiment_scores[final_sentiment]
            
            return {
                'sentiment': final_sentiment,
                'confidence': final_confidence,
                'text': text,
                'method': 'hybrid_weighted',
                'matched_patterns': matched_patterns,
                'vader_sentiment': vader_sentiment,
                'vader_confidence': vader_confidence,
                'vader_scores': vader_scores,
                'slang_sentiment': slang_sentiment,
                'slang_confidence': slang_confidence,
                'weights': {'vader': vader_weight, 'slang': slang_weight}
            }
            
        except Exception as e:
            print(f"Error analyzing sentiment: {e}")
            return {
                'sentiment': 'neutral',
                'confidence': 0.0,
                'text': text,
                'method': 'error'
            }

sentiment_analyzer = SentimentAnalyzer()
