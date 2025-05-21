import os
from dotenv import load_dotenv
import google.generativeai as genai
import json

load_dotenv()

def generate_analysis_summary(analysis_data):
    """Generate a summary of the chat analysis using Gemini AI."""
    try:
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            print("Error: Missing GEMINI_API_KEY in environment variables")
            return "Unable to generate summary: API key not configured"

        print("Configuring Gemini API...")
        genai.configure(api_key=api_key)

        # Create the analysis content
        content = f"""
        Analyze this Twitch chat data:

        Channel: {analysis_data['streamer_name']}
        Total Messages: {analysis_data['total_chats']}

        Sentiment Distribution:
        - Positive: {analysis_data['sentiment_count']['positive']}
        - Neutral: {analysis_data['sentiment_count']['neutral']}
        - Negative: {analysis_data['sentiment_count']['negative']}

        Top Contributors:
        - Most Positive: {', '.join([f"{c['username']}" for c in analysis_data['top_positive'][:5]])}
        - Most Neutral: {', '.join([f"{c['username']}" for c in analysis_data['top_neutral'][:5]])}
        - Most Negative: {', '.join([f"{c['username']}" for c in analysis_data['top_negative'][:5]])}

        Create a summary of the chat analysis based on the data provided. Create a simple one

        Keep the analysis concise but insightful.
        """

        print("Creating Gemini model...")
        # Using gemini-2.0-flash model which is available in the free tier
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        print("Generating content with Gemini API...")
        response = model.generate_content(content)

        if not response:
            print("Error: No response from Gemini API")
            return "Unable to generate summary: No response received"

        # Get the generated text
        summary = response.text.strip()
        if not summary:
            print("Error: Empty summary received")
            return "Unable to generate summary: Empty response"

        print("Successfully generated summary of length:", len(summary))
        return summary

    except Exception as e:
        print(f"Detailed error in generate_analysis_summary:")
        print(f"Error type: {type(e)}")
        print(f"Error message: {str(e)}")
        
        # Handle specific error cases
        error_msg = str(e)
        if "quota" in error_msg.lower() or "429" in error_msg:
            return "Unable to generate summary: API quota exceeded. Please try again later or upgrade to a paid plan."
        
        print(f"Input data keys: {list(analysis_data.keys())}")
        return f"Unable to generate summary. Error: {str(e)}"
