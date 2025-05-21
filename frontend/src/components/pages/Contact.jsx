import React, { useState } from 'react';

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: Implement form submission
    console.log('Form submitted:', formData);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="relative py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center pt-10 pb-16">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
              Get in <span className="text-twitch">Touch</span>
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Have questions about Twitch Insight? We're here to help you get the most from our platform.
            </p>
          </div>

          {/* Contact Form */}
          <div className="bg-black border border-gray-700 rounded-lg p-8 shadow-lg">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full bg-gray-900 border border-gray-700 rounded py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-twitch"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full bg-gray-900 border border-gray-700 rounded py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-twitch"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-300 mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  className="w-full bg-gray-900 border border-gray-700 rounded py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-twitch"
                  required
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-2">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows="6"
                  className="w-full bg-gray-900 border border-gray-700 rounded py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-twitch"
                  required
                ></textarea>
              </div>

              <div>
                <button
                  type="submit"
                  className="w-full bg-twitch hover:bg-twitch-dark text-white font-medium py-3 rounded transition-colors"
                >
                  Send Message
                </button>
              </div>
            </form>
          </div>

          {/* Contact Info */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-black border border-gray-700 p-6 rounded flex flex-col items-center text-center">
              <div className="text-twitch mb-4 p-4 rounded-full">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Email</h3>
              <p className="text-gray-400">support@twitchinsight.com</p>
            </div>

            <div className="bg-black border border-gray-700 p-6 rounded flex flex-col items-center text-center">
              <div className="text-twitch mb-4 p-4 rounded-full">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Location</h3>
              <p className="text-gray-400">San Francisco, CA</p>
            </div>

            <div className="bg-black border border-gray-700 p-6 rounded flex flex-col items-center text-center">
              <div className="text-twitch mb-4 p-4 rounded-full">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Social Media</h3>
              <p className="text-gray-400">@TwitchInsight</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
