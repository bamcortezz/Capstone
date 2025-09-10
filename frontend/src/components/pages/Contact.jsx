import React, { useState } from 'react';
import Swal from 'sweetalert2';
import { ClipLoader } from 'react-spinners';

// API URL
const API_URL = import.meta.env.VITE_API_URL;

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000)); 
      const response = await fetch(`${API_URL}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include',
      });
      const result = await response.json();
      if (response.ok) {
        await Swal.fire({
          title: 'Sent!',
          text: 'Message sent successfully!',
          icon: 'success',
          timer: 1000,
          timerProgressBar: true,
          showConfirmButton: false,
          position: 'top-end',
          toast: true,
          confirmButtonColor: '#9147ff',
          background: '#18181b',
          color: '#fff'
        });
        setFormData({ name: '', email: '', subject: '', message: '' });
      } else {
        await Swal.fire({
          title: 'Error',
          text: result.error,
          icon: 'error',
          showConfirmButton: true,
          confirmButtonColor: '#9147ff',
          background: '#18181b',
          color: '#fff'
        });
      }
    } catch (err) {
      await Swal.fire({
        title: 'Error',
        text: 'An error occurred. Please try again later.',
        icon: 'error',
        showConfirmButton: true,
        confirmButtonColor: '#9147ff',
        background: '#18181b',
        color: '#fff'
      });
    } finally {
      setLoading(false);
    }
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
      <div className="relative py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center pt-6 pb-12">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-4">
              Get in <span className="text-twitch">Touch</span>
            </h1>
            <p className="text-xl text-gray-300 mb-6 max-w-3xl mx-auto">
              Have questions about Twitch Insight? We're here to help you get the most from our platform.
            </p>
          </div>

          {/* Contact Form */}
          <div className="bg-black border border-gray-700 rounded-lg p-4 shadow-lg">
            <form onSubmit={handleSubmit} className="space-y-4">
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
                    placeholder="Enter your name"
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
                    placeholder="Enter your email address"
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
                  placeholder="Enter the subject of your message"
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
                  placeholder="Enter your message"
                  required
                ></textarea>
              </div>

              <div>
                <button
                  type="submit"
                  className="w-full bg-twitch hover:bg-twitch-dark text-white font-medium py-3 rounded transition-colors flex items-center justify-center"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <ClipLoader color="#fff" size={22} className="mr-2" /> Sending...
                    </>
                  ) : (
                    'Send Message'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
