import React from 'react';
import { Link } from 'react-router-dom';

const About = () => {
  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <div className="relative py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center pt-10 pb-16">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
              About <span className="text-twitch">Twitch Insight</span>
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Our mission is to empower streamers with powerful tools to understand their 
              community better and enhance viewer engagement.
            </p>
          </div>

          {/* About Content */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-10 mb-16">
            {/* Left Column */}
            <div>
              <div className="bg-black p-6 rounded border border-gray-700 mb-8">
                <h2 className="text-2xl font-bold text-white mb-4">Our Story</h2>
                <p className="text-gray-300 mb-4">
                  Twitch Insight was born from a simple realization: streamers needed better tools 
                  to understand their chat's sentiment and mood during streams.
                </p>
                <p className="text-gray-300">
                  Founded by a team of streamers and developers, we've built a platform that combines 
                  powerful AI sentiment analysis with an intuitive interface. Our focus is to help streamers 
                  make data-driven decisions that enhance viewer engagement and community building.
                </p>
              </div>

              <div className="bg-black p-6 rounded border border-gray-700">
                <h2 className="text-2xl font-bold text-white mb-4">Our Technology</h2>
                <p className="text-gray-300 mb-4">
                  We utilize cutting-edge natural language processing and machine learning algorithms 
                  to analyze chat messages in real-time and extract meaningful patterns and sentiments.
                </p>
                <p className="text-gray-300">
                  Our platform is built with security and privacy in mind, ensuring that all data 
                  is handled responsibly while providing valuable insights to streamers.
                </p>
              </div>
            </div>

            {/* Right Column */}
            <div>
              <div className="bg-black p-6 rounded border border-gray-700 mb-8">
                <h2 className="text-2xl font-bold text-white mb-4">Our Vision</h2>
                <p className="text-gray-300 mb-4">
                  We believe that understanding your audience is key to building a successful streaming career. 
                  Our vision is to become the leading analytics platform for streamers of all sizes.
                </p>
                <p className="text-gray-300">
                  As we grow, we're committed to developing new features and insights that help streamers 
                  create better content and build stronger communities.
                </p>
              </div>

              <div className="bg-black p-6 rounded border border-gray-700">
                <h2 className="text-2xl font-bold text-white mb-4">Meet the Team</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto rounded-full bg-twitch flex items-center justify-center mb-3">
                      <span className="text-white text-2xl font-bold">A</span>
                    </div>
                    <p className="text-white font-medium">Alex Chen</p>
                    <p className="text-gray-400 text-sm">Founder & CEO</p>
                  </div>
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto rounded-full bg-twitch flex items-center justify-center mb-3">
                      <span className="text-white text-2xl font-bold">J</span>
                    </div>
                    <p className="text-white font-medium">Jamie Rivera</p>
                    <p className="text-gray-400 text-sm">Lead Engineer</p>
                  </div>
                  <div className="text-center mt-4">
                    <div className="w-20 h-20 mx-auto rounded-full bg-twitch flex items-center justify-center mb-3">
                      <span className="text-white text-2xl font-bold">S</span>
                    </div>
                    <p className="text-white font-medium">Sam Taylor</p>
                    <p className="text-gray-400 text-sm">Data Scientist</p>
                  </div>
                  <div className="text-center mt-4">
                    <div className="w-20 h-20 mx-auto rounded-full bg-twitch flex items-center justify-center mb-3">
                      <span className="text-white text-2xl font-bold">M</span>
                    </div>
                    <p className="text-white font-medium">Morgan Lee</p>
                    <p className="text-gray-400 text-sm">UX Designer</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="text-center pb-16">
            <h2 className="text-3xl font-bold text-white mb-6">Ready to get started?</h2>
            <Link
              to="/analyze"
              className="px-6 py-3 bg-twitch hover:bg-twitch-dark text-white font-medium rounded transition-colors"
            >
              Try Twitch Insight
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About; 