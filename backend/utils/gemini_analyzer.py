import os
from dotenv import load_dotenv
import google.generativeai as genai
import json
from datetime import datetime

load_dotenv()

def analyze_time_series(time_series, duration_seconds):
    """
    Analyze time series data to extract temporal sentiment distribution patterns.
    
    Args:
        time_series: List of dicts with 'x' (timestamp ms), 'y' (proportion 0-1), and 'sentiment' (positive/neutral/negative)
        duration_seconds: Total duration of the stream in seconds
    
    Returns:
        String with formatted temporal insights
    """
    if not time_series or len(time_series) < 2:
        return "- Insufficient data for temporal analysis"
    
    try:
        # Separate data by sentiment
        sentiment_data = {
            'positive': [],
            'neutral': [],
            'negative': []
        }
        
        for point in time_series:
            sentiment = point.get('sentiment', 'neutral')
            y_val = point.get('y')
            if isinstance(y_val, (int, float)) and sentiment in sentiment_data:
                sentiment_data[sentiment].append(y_val)
        
        # Check if we have valid data
        total_points = sum(len(values) for values in sentiment_data.values())
        if total_points == 0:
            return "- No valid distribution data available"
        
        # Analyze each sentiment separately
        sentiment_insights = {}
        for sentiment, values in sentiment_data.items():
            if not values:
                continue
                
            avg_proportion = sum(values) / len(values)
            
            # Analyze trend (first half vs second half)
            if len(values) >= 2:
                mid_point = len(values) // 2
                first_half = sum(values[:mid_point]) / mid_point if mid_point > 0 else avg_proportion
                second_half = sum(values[mid_point:]) / (len(values) - mid_point) if mid_point < len(values) else avg_proportion
                trend = second_half - first_half
            else:
                trend = 0
            
            sentiment_insights[sentiment] = {
                'avg': avg_proportion,
                'count': len(values),
                'trend': trend
            }
        
        # Calculate overall statistics
        all_values = [v for values in sentiment_data.values() for v in values]
        avg_distribution = sum(all_values) / len(all_values)
        max_proportion = max(all_values)
        min_proportion = min(all_values)
        
        # Calculate volatility (how much sentiment distribution varies over time)
        variance = sum((x - avg_distribution) ** 2 for x in all_values) / len(all_values)
        volatility = variance ** 0.5
        
        # Determine volatility level
        if volatility < 0.1:
            volatility_level = "very stable"
        elif volatility < 0.15:
            volatility_level = "stable"
        elif volatility < 0.25:
            volatility_level = "moderate"
        else:
            volatility_level = "volatile"
        
        # Format insights with sentiment-specific data
        insights_parts = [
            f"- Average Sentiment Distribution: {avg_distribution:.1%} per sentiment category",
            f"- Distribution Range: {min_proportion:.1%} to {max_proportion:.1%}",
            f"- Sentiment Consistency: {volatility_level} (volatility: {volatility:.2f})",
            ""
        ]
        
        # Add sentiment-specific insights
        insights_parts.append("Sentiment Distribution by Type:")
        for sentiment in ['positive', 'neutral', 'negative']:
            if sentiment in sentiment_insights:
                data = sentiment_insights[sentiment]
                trend_desc = "steady"
                if abs(data['trend']) >= 0.05:
                    if data['trend'] > 0:
                        trend_desc = f"increasing (+{data['trend']:.1%})"
                    else:
                        trend_desc = f"decreasing ({data['trend']:.1%})"
                
                sentiment_cap = sentiment.capitalize()
                insights_parts.append(
                    f"  • {sentiment_cap}: {data['avg']:.1%} average proportion per minute, {data['count']} data points, {trend_desc}"
                )
        
        insights_parts.append("")
        insights_parts.append(f"- Total Data Points: {total_points} minute-level samples over {duration_seconds // 60:.0f} minutes")
        
        return "\n        ".join(insights_parts)
        
    except Exception as e:
        print(f"Error analyzing time series: {e}")
        import traceback
        traceback.print_exc()
        return f"- Time series analysis error: {str(e)}"

def generate_analysis_summary(analysis_data):
    try:
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            print("Error: Missing GEMINI_API_KEY in environment variables")
            return "Unable to generate summary: API key not configured"

        print("Configuring Gemini API...")
        genai.configure(api_key=api_key)

        # Format duration as HH:MM:SS
        def format_duration(seconds):
            h = int(seconds) // 3600
            m = (int(seconds) % 3600) // 60
            s = int(seconds) % 60
            return f"{h:02d}:{m:02d}:{s:02d}"
        duration_val = analysis_data.get('duration', 0)
        formatted_duration = format_duration(duration_val)

        # Analyze time series data for temporal patterns
        time_series = analysis_data.get('time_series', [])
        time_series_insights = analyze_time_series(time_series, duration_val)

        # Calculate percentages for cleaner presentation
        total_messages = analysis_data['total_chats']
        positive_pct = (analysis_data['sentiment_count']['positive'] / total_messages * 100) if total_messages > 0 else 0
        neutral_pct = (analysis_data['sentiment_count']['neutral'] / total_messages * 100) if total_messages > 0 else 0
        negative_pct = (analysis_data['sentiment_count']['negative'] / total_messages * 100) if total_messages > 0 else 0

        # Create the analysis content with enhanced time series insights
        content = f"""
        Generate a professional analysis summary for the following Twitch stream data:

        STREAM DATA:
        Channel: {analysis_data['streamer_name']}
        Duration: {formatted_duration}
        Total Messages: {total_messages:,}

        SENTIMENT DISTRIBUTION:
        - Positive: {analysis_data['sentiment_count']['positive']:,} ({positive_pct:.1f}%)
        - Neutral: {analysis_data['sentiment_count']['neutral']:,} ({neutral_pct:.1f}%)
        - Negative: {analysis_data['sentiment_count']['negative']:,} ({negative_pct:.1f}%)

        TOP CONTRIBUTORS:
        - Most Positive: {', '.join([c['username'] for c in analysis_data['top_positive'][:3]]) if analysis_data['top_positive'] else 'None'}
        - Most Neutral: {', '.join([c['username'] for c in analysis_data['top_neutral'][:3]]) if analysis_data['top_neutral'] else 'None'}
        - Most Negative: {', '.join([c['username'] for c in analysis_data['top_negative'][:3]]) if analysis_data['top_negative'] else 'None'}

        TEMPORAL ANALYSIS:
        {time_series_insights}

        ANALYSIS REQUIREMENTS:
        1. Provide a concise executive summary (2-3 sentences) of overall sentiment performance
        2. Based on the temporal data above, identify specific trends and patterns in sentiment distribution
        3. Reference actual data points from the temporal analysis (volatility levels, trend directions, distribution ranges)
        4. Provide 2-3 actionable recommendations based on the observed patterns
        5. Maintain a professional, data-driven tone
        6. Keep the summary under 150 words
        7. Focus on insights derived from the chart data, not assumptions
        8. Make words simple and easy to understand, but at the same time make it formal and direct.
        """

        print("Creating Gemini model...")
        model = genai.GenerativeModel('gemini-2.5-flash')
        
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
        
        error_msg = str(e)
        if "quota" in error_msg.lower() or "429" in error_msg:
            return "Unable to generate summary: API quota exceeded. Please try again later or upgrade to a paid plan."
        
        print(f"Input data keys: {list(analysis_data.keys())}")
        return f"Unable to generate summary. Error: {str(e)}"
