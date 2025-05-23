import os
from dotenv import load_dotenv
import google.generativeai as genai
import json

load_dotenv()

def generate_analysis_summary(analysis_data):
    try:
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            print("Error: Missing GEMINI_API_KEY in environment variables")
            return "Unable to generate summary: API key not configured"

        print("Configuring Gemini API...")
        genai.configure(api_key=api_key)

        # Create the analysis content
        content = f"""
        Generate a concise summary of the following Twitch chat analysis:

        Channel: {analysis_data['streamer_name']}
        Total Messages: {analysis_data['total_chats']}

        Sentiment Breakdown:
        - Positive: {analysis_data['sentiment_count']['positive']}
        - Neutral: {analysis_data['sentiment_count']['neutral']}
        - Negative: {analysis_data['sentiment_count']['negative']}

        Top Chatters:
        - Most Positive: {', '.join([c['username'] for c in analysis_data['top_positive'][:5]])}
        - Most Neutral: {', '.join([c['username'] for c in analysis_data['top_neutral'][:5]])}
        - Most Negative: {', '.join([c['username'] for c in analysis_data['top_negative'][:5]])}

        Instructions:
        1. Calculate and include the percentage distribution of positive, neutral, and negative messages.
        2. Provide a brief insight or takeaway for the streamer based on this sentiment data.
        3. Keep the tone informative and the summary short and clear.
        4. Make an insight of the chat, what the streamer is doing well and what they could improve on.
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
