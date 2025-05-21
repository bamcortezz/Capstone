import React from 'react';
import { Link } from 'react-router-dom';

const Features = () => {
  return (
    <div className="min-h-screen bg-black">
      <div className="relative py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center pt-10 pb-16">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
              Powerful <span className="text-twitch">Features</span>
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Discover how our sentiment analysis tools can help you understand and engage with your Twitch community better.
            </p>
          </div>

          {/* Main Features */}
          <div className="mt-10 mb-20">
            {/* Feature 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-24">
              <div className="order-2 md:order-1">
                <h2 className="text-3xl font-bold text-white mb-4">Real-time Sentiment Analysis</h2>
                <p className="text-gray-300 mb-6">
                  Analyze your chat sentiment instantly as messages come in. Our advanced AI interprets
                  emotional cues to give you a clear understanding of your audience's mood in real-time.
                </p>
                <ul className="space-y-3">
                  {['Instant message processing', 'Sentiment classification', 'Trend detection', 'Outlier identification'].map((item, index) => (
                    <li key={index} className="flex items-start">
                      <svg className="w-5 h-5 text-twitch mt-1 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-300">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="order-1 md:order-2 bg-black border border-gray-700 rounded-lg p-8">
                <div className="aspect-w-16 aspect-h-9 bg-gray-900 rounded-lg flex items-center justify-center">
                  <div className="text-twitch">
                    <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.75 17L9 20l-1 1h8l-1-1l-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-24">
              <div className="bg-black border border-gray-700 rounded-lg p-8">
                <div className="aspect-w-16 aspect-h-9 bg-gray-900 rounded-lg flex items-center justify-center">
                  <div className="text-twitch">
                    <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white mb-4">Advanced Analytics Dashboard</h2>
                <p className="text-gray-300 mb-6">
                  Get comprehensive insights through our intuitive analytics dashboard. View sentiment trends, 
                  identify patterns, and understand what content resonates with your audience.
                </p>
                <ul className="space-y-3">
                  {['Customizable charts and graphs', 'Historical data comparison', 'User sentiment profiles', 'Engagement metrics'].map((item, index) => (
                    <li key={index} className="flex items-start">
                      <svg className="w-5 h-5 text-twitch mt-1 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-300">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div className="order-2 md:order-1">
                <h2 className="text-3xl font-bold text-white mb-4">Historical Data Analysis</h2>
                <p className="text-gray-300 mb-6">
                  Look back at previous streams to identify patterns and trends. Our platform securely
                  stores your chat data and provides powerful tools to analyze performance over time.
                </p>
                <ul className="space-y-3">
                  {['Long-term trend analysis', 'Stream comparison', 'Content performance metrics', 'Audience growth insights'].map((item, index) => (
                    <li key={index} className="flex items-start">
                      <svg className="w-5 h-5 text-twitch mt-1 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-gray-300">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="order-1 md:order-2 bg-black border border-gray-700 rounded-lg p-8">
                <div className="aspect-w-16 aspect-h-9 bg-gray-900 rounded-lg flex items-center justify-center">
                  <div className="text-twitch">
                    <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="text-center pb-16 pt-10 border-t border-gray-800">
            <h2 className="text-3xl font-bold text-white mb-6">Ready to analyze your Twitch chat?</h2>
            <p className="text-gray-300 mb-8 max-w-3xl mx-auto">
              Start using Twitch Insight today and gain valuable insights into your audience.
            </p>
            <div className="flex justify-center gap-4">
              <Link
                to="/analyze"
                className="px-6 py-3 bg-twitch hover:bg-twitch-dark text-white font-medium rounded transition-colors"
              >
                Start Analyzing
              </Link>
              <Link
                to="/contact"
                className="px-6 py-3 bg-transparent hover:bg-gray-800 text-white font-medium rounded border border-gray-700 transition-colors"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Features; 