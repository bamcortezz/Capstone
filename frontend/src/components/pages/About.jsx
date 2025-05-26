import React from 'react';
import { Link } from 'react-router-dom';
import cortezImg from '../../assets/img/Cortez, Francis Emil M..jpg';
import gaspanImg from '../../assets/img/Gaspan, Hyrum.jpg';
import gutierrezImg from '../../assets/img/Gutierrez, Marvie M..jpg';
import pringImg from '../../assets/img/Pring, Christian Angelo M..jpg';
import medranoImg from '../../assets/img/Medrano, Vincent C..jpg';
import tadiamanImg from '../../assets/img/Tadiaman, Justine S..jpg';

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
                  The researchers are third-year Information Technology students who developed Twitch Insight 
                  as their capstone project, aiming to enhance the streaming experience on Twitch.
                </p>
                <p className="text-gray-300">
                  This project focuses on helping streamers better understand their audience's reactions 
                  through real-time chat analysis, enabling them to create more engaging content and build 
                  stronger communities.
                </p>
              </div>

              <div className="bg-black p-6 rounded border border-gray-700">
                <h2 className="text-2xl font-bold text-white mb-4">Technology Used</h2>
                <p className="text-gray-300 mb-4">
                  The researchers developed a platform that integrates the Twitch API to fetch real-time chat messages 
                  and employs RoBERTa, a state-of-the-art natural language model, for accurate sentiment analysis.
                  Additionally, Google's Gemini API is utilized to generate comprehensive text summaries of the analyzed data.
                </p>
                <p className="text-gray-300">
                  This research implementation provides streamers with reliable, instant insights into their 
                  chat's emotional tone, engagement levels, and meaningful summaries of chat interactions.
                </p>
              </div>
            </div>

            {/* Right Column */}
            <div>
              <div className="bg-black p-6 rounded border border-gray-700">
                <h2 className="text-2xl font-bold text-white mb-4">Researchers</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto rounded-full bg-twitch flex items-center justify-center mb-3 overflow-hidden">
                      {cortezImg ? (
                        <img src={cortezImg} alt="Francis Emil M. Cortez" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white text-2xl font-bold">C</span>
                      )}
                    </div>
                    <p className="text-white font-medium">Cortez, Francis Emil M.</p>
                  </div>
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto rounded-full bg-twitch flex items-center justify-center mb-3 overflow-hidden">
                      {gaspanImg ? (
                        <img src={gaspanImg} alt="Hyrum P. Gaspan" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white text-2xl font-bold">H</span>
                      )}
                    </div>
                    <p className="text-white font-medium">Gaspan, Hyrum P.</p>
                  </div>
                  <div className="text-center mt-4">
                    <div className="w-20 h-20 mx-auto rounded-full bg-twitch flex items-center justify-center mb-3 overflow-hidden">
                      {gutierrezImg ? (
                        <img src={gutierrezImg} alt="Marvie M. Gutierrez" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white text-2xl font-bold">M</span>
                      )}
                    </div>
                    <p className="text-white font-medium">Gutierrez, Marvie M.</p>
                  </div>
                  <div className="text-center mt-4">
                    <div className="w-20 h-20 mx-auto rounded-full bg-twitch flex items-center justify-center mb-3 overflow-hidden">
                      {medranoImg ? (
                        <img src={medranoImg} alt="Vincent C. Medrano" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white text-2xl font-bold">V</span>
                      )}
                    </div>
                    <p className="text-white font-medium">Medrano, Vincent C.</p>
                  </div>
                  <div className="text-center mt-4">
                    <div className="w-20 h-20 mx-auto rounded-full bg-twitch flex items-center justify-center mb-3 overflow-hidden">
                      {pringImg ? (
                        <img src={pringImg} alt="Christian Angelo M. Pring" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white text-2xl font-bold">C</span>
                      )}
                    </div>
                    <p className="text-white font-medium">Pring, Christian Angelo M.</p>
                  </div>
                  <div className="text-center mt-4">
                    <div className="w-20 h-20 mx-auto rounded-full bg-twitch flex items-center justify-center mb-3 overflow-hidden">
                      {tadiamanImg ? (
                        <img src={tadiamanImg} alt="Justine S. Tadiaman" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white text-2xl font-bold">J</span>
                      )}
                    </div>
                    <p className="text-white font-medium">Tadiaman, Justine S.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About; 