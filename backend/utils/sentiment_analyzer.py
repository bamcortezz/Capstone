from transformers import pipeline
import torch
import warnings
import re
from transformers import logging

# Import Twitch slang configuration
try:
    from .twitch_slang_config import get_all_patterns
except ImportError:
    # Fallback if config file is not available
    def get_all_patterns():
        return {}

logging.set_verbosity_error()
warnings.filterwarnings('ignore', message='Some weights of the model checkpoint')

class SentimentAnalyzer:
    def __init__(self):
        self.analyzer = pipeline(
            "sentiment-analysis",
            model="cardiffnlp/twitter-roberta-base-sentiment-latest",
            device=0 if torch.cuda.is_available() else -1 
        )
        
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
            # Truncate text to prevent tensor size issues
            max_length = 512
            if len(text) > max_length:
                text = text[:max_length]
            
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
            
            # 2. ALWAYS run RoBERTa for context understanding
            roberta_result = self.analyzer(text)[0]
            roberta_label = roberta_result['label']
            roberta_score = roberta_result['score']
            
            sentiment_map = {
                'LABEL_0': 'negative',
                'LABEL_1': 'neutral',
                'LABEL_2': 'positive'
            }
            roberta_sentiment = sentiment_map.get(roberta_label, roberta_label)
            
            # If no Twitch slang detected, trust RoBERTa completely
            if not twitch_result:
                return {
                    'sentiment': roberta_sentiment,
                    'confidence': roberta_score,
                    'text': text,
                    'method': 'roberta'
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
                    'roberta_sentiment': roberta_sentiment,
                    'roberta_confidence': roberta_score
                }
            
            # Case 2: Sentiments AGREE - boost confidence
            if slang_sentiment == roberta_sentiment:
                # Both methods agree, high confidence
                combined_confidence = min((slang_confidence + roberta_score) / 2 * 1.15, 0.99)
                return {
                    'sentiment': roberta_sentiment,
                    'confidence': combined_confidence,
                    'text': text,
                    'method': 'hybrid_agreement',
                    'matched_patterns': matched_patterns,
                    'roberta_confidence': roberta_score,
                    'slang_confidence': slang_confidence
                }
            
            # Case 3: Sentiments DISAGREE - need smart resolution
            # This is where "I hate you lol" gets handled correctly
            
            # Check if RoBERTa has strong conviction
            roberta_strong = roberta_score > 0.75
            slang_strong = slang_confidence > 0.85
            
            # Sub-case 3a: Short message (3-5 words) with strong slang
            if word_count <= 5 and slang_strong and not roberta_strong:
                # Likely emote-heavy message, lean towards slang
                # But reduce confidence due to disagreement
                confidence = slang_confidence * 0.7
                return {
                    'sentiment': slang_sentiment,
                    'confidence': confidence,
                    'text': text,
                    'method': 'hybrid_slang_weighted',
                    'matched_patterns': matched_patterns,
                    'roberta_sentiment': roberta_sentiment,
                    'roberta_confidence': roberta_score
                }
            
            # Sub-case 3b: RoBERTa has strong conviction (likely sarcasm/toxicity)
            # Example: "I hate you lol" - RoBERTa sees "hate" strongly
            if roberta_strong:
                # Trust RoBERTa's context understanding
                # This handles: toxic message + laughing emote = still toxic
                return {
                    'sentiment': roberta_sentiment,
                    'confidence': roberta_score * 0.95,  # Slight reduction for disagreement
                    'text': text,
                    'method': 'hybrid_roberta_strong',
                    'matched_patterns': matched_patterns,
                    'slang_sentiment': slang_sentiment,
                    'slang_confidence': slang_confidence
                }
            
            # Sub-case 3c: Both weak or medium - weighted average
            # Weight RoBERTa more for longer messages
            roberta_weight = min(0.5 + (word_count * 0.05), 0.8)  # 50%-80% based on length
            slang_weight = 1 - roberta_weight
            
            # Calculate weighted confidence for each sentiment
            sentiment_scores = {
                'positive': 0.0,
                'neutral': 0.0,
                'negative': 0.0
            }
            
            sentiment_scores[roberta_sentiment] += roberta_score * roberta_weight
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
                'roberta_sentiment': roberta_sentiment,
                'roberta_confidence': roberta_score,
                'slang_sentiment': slang_sentiment,
                'slang_confidence': slang_confidence,
                'weights': {'roberta': roberta_weight, 'slang': slang_weight}
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
