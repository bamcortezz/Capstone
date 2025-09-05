from transformers import pipeline
import torch
import warnings
from transformers import logging

logging.set_verbosity_error()
warnings.filterwarnings('ignore', message='Some weights of the model checkpoint')

class SentimentAnalyzer:
    def __init__(self):

        self.analyzer = pipeline(
            "sentiment-analysis",
            model="cardiffnlp/twitter-roberta-base-sentiment-latest",
            device=0 if torch.cuda.is_available() else -1 
        )

    def analyze_text(self, text):
        try:
            
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
                'text': text
            }
        except Exception as e:
            print(f"Error analyzing sentiment: {e}")
            return {
                'sentiment': 'neutral',
                'confidence': 0.0,
                'text': text
            }

sentiment_analyzer = SentimentAnalyzer()
