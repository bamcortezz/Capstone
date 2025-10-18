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
            
            # First, check for Twitch-specific slang
            twitch_result = self.detect_twitch_slang(text)
            
            if twitch_result:
                sentiment, confidence, matched_patterns = twitch_result
                return {
                    'sentiment': sentiment,
                    'confidence': confidence,
                    'text': text,
                    'method': 'twitch_slang',
                    'matched_patterns': matched_patterns
                }
            
            # If no Twitch slang detected, use RoBERTa
            result = self.analyzer(text)[0]
            label = result['label']
            score = result['score']

            sentiment_map = {
                'LABEL_0': 'negative',
                'LABEL_1': 'neutral',
                'LABEL_2': 'positive'
            }

            return {
                'sentiment': sentiment_map.get(label, label),
                'confidence': score,
                'text': text,
                'method': 'roberta'
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
