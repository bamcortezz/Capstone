// filepath: d:\Coding Practice\MongoDB\frontend\src\components\auth\Register.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ClipLoader } from "react-spinners";
import Swal from "sweetalert2";

// API URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const { first_name, last_name, email, password, confirmPassword } = formData;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agreed) {
      Swal.fire({
        position: 'top-end',
        icon: 'error',
        title: 'You must agree to the Privacy Policy',
        toast: true,
        timerProgressBar: true,
        showConfirmButton: false,
        timer: 1200,
        confirmButtonColor: '#9147ff',
        background: '#18181b',
        color: '#fff'
      });
      return;
    }
    if (password !== confirmPassword) {
      Swal.fire({
        position: 'top-end',
        icon: 'error',
        title: 'Passwords do not match',
        toast: true,
        timerProgressBar: true,
        showConfirmButton: false,
        timer: 1000,
        confirmButtonColor: '#9147ff',
        background: '#18181b',
        color: '#fff'
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name,
          last_name,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Show success message
      await Swal.fire({
        position: 'top-end',
        icon: 'success',
        title: 'Registration successful!',
        text: 'Please verify your email',
        toast: true,
        timerProgressBar: true,
        showConfirmButton: false,
        timer: 1000,
        confirmButtonColor: '#9147ff',
        background: '#18181b',
        color: '#fff'
      });

      // Reset form
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        confirmPassword: ''
      });
      
      // Navigate to OTP verification page
      navigate('/verify-otp', { state: { email: data.email } });
      
    } catch (err) {
      Swal.fire({
        position: 'top-end',
        icon: 'error',
        title: 'Registration Failed',
        text: err.message,
        toast: true,
        timerProgressBar: true,
        showConfirmButton: false,
        timer: 1000,
        confirmButtonColor: '#9147ff',
        background: '#18181b',
        color: '#fff'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="relative py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-md mx-auto">
            <div className="bg-black p-8 rounded border border-gray-700 shadow-xl">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-3">
                  Create <span className="text-twitch">Account</span>
                </h2>
                <p className="text-gray-300">
                  Start analyzing Twitch chat sentiments today
                </p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="first_name" className="block text-sm font-medium text-gray-300 mb-2">
                      First Name
                    </label>
                    <input
                      type="text"
                      id="first_name"
                      name="first_name"
                      value={first_name}
                      onChange={handleChange}
                      required
                      className="w-full p-3 rounded-lg bg-black border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-twitch"
                      placeholder="First Name"
                    />
                  </div>

                  <div>
                    <label htmlFor="last_name" className="block text-sm font-medium text-gray-300 mb-2">
                      Last Name
                    </label>
                    <input
                      type="text"
                      id="last_name"
                      name="last_name"
                      value={last_name}
                      onChange={handleChange}
                      required
                      className="w-full p-3 rounded-lg bg-black border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-twitch"
                      placeholder="Last Name"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={email}
                    onChange={handleChange}
                    required
                    className="w-full p-3 rounded-lg bg-black border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-twitch"
                    placeholder="Email"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      value={password}
                      onChange={handleChange}
                      required
                      className="w-full p-3 rounded-lg bg-black border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-twitch"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={togglePasswordVisibility}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-white focus:outline-none"
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    Password must be at least 8 characters and include uppercase, lowercase, 
                    numbers, and special characters.
                  </p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      id="confirmPassword"
                      name="confirmPassword"
                      value={confirmPassword}
                      onChange={handleChange}
                      required
                      className="w-full p-3 rounded-lg bg-black border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-twitch"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={toggleConfirmPasswordVisibility}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-white focus:outline-none"
                    >
                      {showConfirmPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Privacy Policy Agreement */}
                <div className="flex items-start mb-4 mt-6">
                  <input
                    id="privacy-policy"
                    name="privacy-policy"
                    type="checkbox"
                    checked={agreed}
                    onChange={e => setAgreed(e.target.checked)}
                    className="h-4 w-4 text-twitch focus:ring-twitch border-gray-700 rounded mr-2 mt-1"
                    required
                  />
                  <label htmlFor="privacy-policy" className="text-sm text-gray-300 select-none flex flex-wrap items-center gap-x-1">
                    I agree to the
                    <button
                      type="button"
                      className="text-twitch underline hover:text-twitch-dark focus:outline-none"
                      onClick={() => setShowPolicy(true)}
                    >
                      Privacy Policy
                    </button>
                    and
                    <button
                      type="button"
                      className="text-twitch underline hover:text-twitch-dark focus:outline-none"
                      onClick={() => setShowAgreement(true)}
                    >
                      User Agreement
                    </button>.
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !agreed}
                  className={`w-full py-3 rounded-lg font-medium transition-colors flex items-center justify-center mt-2
                    ${
                      !agreed || isLoading
                        ? 'bg-gray-600 cursor-not-allowed text-gray-300'
                        : 'bg-twitch hover:bg-twitch-dark text-white'
                    }
                  `}
                >
                  {isLoading ? (
                    <ClipLoader size={24} color="#9146FF" />
                  ) : (
                    "Create Account"
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Privacy Policy Modal (History page style) */}
      {showPolicy && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto relative border border-gray-700 shadow-xl">
            {/* Close Button */}
            <button
              onClick={() => setShowPolicy(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="p-6">
              {/* Header with Icon */}
              <div className="flex flex-col items-center mb-6">
                <span className="bg-twitch/20 p-3 rounded-full mb-2">
                  <svg className="w-10 h-10 text-twitch" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A13.937 13.937 0 0112 15c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
                <h3 className="text-2xl font-bold text-white mb-1">Privacy Policy</h3>
                <p className="text-gray-400 text-sm text-center max-w-xs">Your privacy, data security, and user rights are important to us. Please review how we handle your information below.</p>
              </div>
              {/* Divider */}
              <div className="border-t border-gray-700 my-4"></div>
              <div className="space-y-6">
                {/* Intellectual Property */}
                <div className="flex items-start gap-3">
                  <span className="mt-1">
                    <svg className="w-6 h-6 text-twitch" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V9a2 2 0 012-2h8zm0 0V5a2 2 0 00-2-2H10a2 2 0 00-2 2v2" />
                    </svg>
                  </span>
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-1">Intellectual Property</h4>
                    <p className="text-gray-300 text-sm">Twitch Insight and its licensors own all content, trademarks, and related intellectual property. You agree not to use, reproduce, or distribute content without our consent.</p>
                  </div>
                </div>
                {/* Termination */}
                <div className="flex items-start gap-3">
                  <span className="mt-1">
                    <svg className="w-6 h-6 text-twitch" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-1.414 1.414A9 9 0 105.636 18.364l1.414-1.414A7 7 0 1116.95 7.05z" />
                    </svg>
                  </span>
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-1">Termination</h4>
                    <p className="text-gray-300 text-sm">Twitch Insight reserves the right to terminate or suspend your account or access at any time for violations of these terms or misuse of the service.</p>
                  </div>
                </div>
                {/* User Data */}
                <div className="flex items-start gap-3">
                  <span className="mt-1">
                    <svg className="w-6 h-6 text-twitch" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A13.937 13.937 0 0112 15c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </span>
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-1">User Information</h4>
                    <p className="text-gray-300 text-sm">We collect your name, email, and password when you register. This information is used for authentication, account management, and support.</p>
                  </div>
                </div>
                {/* Security */}
                <div className="flex items-start gap-3">
                  <span className="mt-1">
                    <svg className="w-6 h-6 text-twitch" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0-1.657 1.343-3 3-3s3 1.343 3 3v2a3 3 0 01-3 3h-1v2a1 1 0 01-2 0v-2h-1a3 3 0 01-3-3v-2c0-1.657 1.343-3 3-3s3 1.343 3 3z" />
                    </svg>
                  </span>
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-1">Security</h4>
                    <p className="text-gray-300 text-sm">We use industry-standard security practices to protect your data, including encryption and secure authentication. We never sell your data and only share it as required to provide our services or by law.</p>
                  </div>
                </div>
                {/* Your Rights */}
                <div className="flex items-start gap-3">
                  <span className="mt-1">
                    <svg className="w-6 h-6 text-twitch" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2a4 4 0 014-4h4m0 0V7a4 4 0 00-4-4H7a4 4 0 00-4 4v10a4 4 0 004 4h4" />
                    </svg>
                  </span>
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-1">Your Rights</h4>
                    <p className="text-gray-300 text-sm">You can access, update, or request deletion of your account and data at any time. Contact us if you have questions or need assistance with your data.</p>
                  </div>
                </div>
                {/* Contact */}
                <div className="flex items-start gap-3">
                  <span className="mt-1">
                    <svg className="w-6 h-6 text-twitch" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12v1m0 4v.01M8 12v1m0 4v.01M21 12c0 4.418-4.03 8-9 8s-9-3.582-9-8a9 9 0 1118 0z" />
                    </svg>
                  </span>
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-1">Contact</h4>
                    <p className="text-gray-300 text-sm">For privacy questions or requests, please use the Contact page. We are committed to addressing your concerns promptly.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {showAgreement && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto relative border border-gray-700 shadow-xl">
            {/* Close Button */}
            <button
              onClick={() => setShowAgreement(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="p-6">
              {/* Header with Icon */}
              <div className="flex flex-col items-center mb-6">
                <span className="bg-twitch/20 p-3 rounded-full mb-2">
                  <svg className="w-10 h-10 text-twitch" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2a4 4 0 014-4h4m0 0V7a4 4 0 00-4-4H7a4 4 0 00-4 4v10a4 4 0 004 4h4" />
                  </svg>
                </span>
                <h3 className="text-2xl font-bold text-white mb-1">User Agreement</h3>
                <p className="text-gray-400 text-sm text-center max-w-xs">Please review the terms and conditions for using our service below.</p>
              </div>
              <div className="border-t border-gray-700 my-4"></div>
              <div className="space-y-6">
                {/* Acceptance of Terms */}
                <div className="flex items-start gap-3">
                  <span className="mt-1">
                    <svg className="w-6 h-6 text-twitch" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-1">Acceptance of Terms</h4>
                    <p className="text-gray-300 text-sm">By accessing and utilizing Twitch Insight, you agree to comply with and be bound by these terms and all applicable laws and regulations. If you do not agree with any part of these terms, you must not use the service.</p>
                  </div>
                </div>
                {/* Modification of Terms */}
                <div className="flex items-start gap-3">
                  <span className="mt-1">
                    <svg className="w-6 h-6 text-twitch" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8h2a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8a2 2 0 012-2h2m2-4h4a2 2 0 012 2v4a2 2 0 01-2 2h-4a2 2 0 01-2-2V6a2 2 0 012-2z" />
                    </svg>
                  </span>
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-1">Modification of Terms</h4>
                    <p className="text-gray-300 text-sm">Twitch Insight reserves the right to change, modify, or update these terms at any time. Continued use of the service after such changes constitutes your acceptance of the new terms.</p>
                  </div>
                </div>
                {/* Eligibility */}
                <div className="flex items-start gap-3">
                  <span className="mt-1">
                    <svg className="w-6 h-6 text-twitch" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0-1.657 1.343-3 3-3s3 1.343 3 3v2a3 3 0 01-3 3h-1v2a1 1 0 01-2 0v-2h-1a3 3 0 01-3-3v-2c0-1.657 1.343-3 3-3s3 1.343 3 3z" />
                    </svg>
                  </span>
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-1">Eligibility</h4>
                    <p className="text-gray-300 text-sm">You must be at least 14 years old to use Twitch Insight. By registering, you represent and warrant that you meet this age requirement.</p>
                  </div>
                </div>
                {/* Account Registration */}
                <div className="flex items-start gap-3">
                  <span className="mt-1">
                    <svg className="w-6 h-6 text-twitch" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A13.937 13.937 0 0112 15c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </span>
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-1">Account Registration</h4>
                    <p className="text-gray-300 text-sm">To access certain features, you must create an account by providing accurate and complete information. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Register;