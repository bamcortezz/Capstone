import React from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <div className="relative py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center pt-10 pb-16">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
              Understand Your <span className="text-twitch">Twitch Chat</span> Better
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Real-time sentiment analysis and chat insights to help streamers and
              moderators make data-driven decisions.
            </p>
            <div className="flex justify-center gap-4 mt-10">
              <Link
                to="/analyze"
                className="px-6 py-3 bg-twitch hover:bg-twitch-dark text-white font-medium rounded transition-colors"
              >
                Start Analyzing
              </Link>
              <Link
                to="/features"
                className="px-6 py-3 bg-transparent hover:bg-gray-800 text-white font-medium rounded border border-gray-700 transition-colors"
              >
                Learn More
              </Link>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-black p-6 rounded border border-gray-700 flex flex-col items-center text-center">
              <div className="text-twitch mb-4 p-4 rounded-full">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1l-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Real-time Analysis</h3>
              <p className="text-gray-400">
                Monitor chat sentiment and trends as they happen, helping you make quick decisions.
              </p>
            </div>

            <div className="bg-black p-6 rounded border border-gray-700 flex flex-col items-center text-center">
              <div className="text-twitch mb-4 p-4 rounded-full">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Sentiment Tracking</h3>
              <p className="text-gray-400">
                Understand the emotional tone of your chat with advanced sentiment analysis.
              </p>
            </div>

            <div className="bg-black p-6 rounded border border-gray-700 flex flex-col items-center text-center">
              <div className="text-twitch mb-4 p-4 rounded-full">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Historical Data</h3>
              <p className="text-gray-400">
                Access past chat analytics to identify patterns and improve engagement.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
