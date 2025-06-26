import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ClipLoader } from "react-spinners";
import Swal from "sweetalert2";

// API URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ResetPassword = () => {
  const navigate = useNavigate();
  const { userId, token } = useParams();
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isValidToken, setIsValidToken] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { password, confirmPassword } = formData;
  // Verify token on component mount
  useEffect(() => {
    if (!token || !userId) {
      setIsValidToken(false);
      Swal.fire({
        position: 'top-end',
        icon: 'error',
        title: 'Invalid Reset Link',
        text: 'The reset link is missing or invalid',
        toast: true,
        timerProgressBar: true,
        showConfirmButton: false,
        timer: 1000,
        background: '#18181b',
        color: '#fff'
      });
      return;
    }

    const validateToken = async () => {
      try {
        const response = await fetch(`${API_URL}/api/validate-reset-token/${userId}/${token}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (!response.ok) {
          setIsValidToken(false);
          throw new Error('The reset link is expired or invalid');
        }
      } catch (err) {
        setIsValidToken(false);
        Swal.fire({
          position: 'top-end',
          icon: 'error',
          title: 'Invalid Reset Link',
          text: err.message,
          toast: true,
          timerProgressBar: true,
          showConfirmButton: false,
          timer: 1000,
          background: '#18181b',
          color: '#fff'
        });
      }
    };

    validateToken();
  }, [token, userId]);

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

    if (password !== confirmPassword) {
      Swal.fire({
        position: 'top-end',
        icon: 'error',
        title: 'Passwords do not match',
        toast: true,
        timerProgressBar: true,
        showConfirmButton: false,
        timer: 1000,
        background: '#18181b',
        color: '#fff'
      });
      return;
    } setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Password reset failed');
      }

      await Swal.fire({
        position: 'top-end',
        icon: 'success',
        title: 'Password Reset Successful!',
        text: 'You can now login with your new password',
        toast: true,
        timerProgressBar: true,
        showConfirmButton: false,
        timer: 1000,
        background: '#18181b',
        color: '#fff'
      });

      // Navigate to login page after successful password reset
      navigate('/login');

    } catch (err) {
      Swal.fire({
        position: 'top-end',
        icon: 'error',
        title: 'Password Reset Failed',
        text: err.message,
        toast: true,
        timerProgressBar: true,
        showConfirmButton: false,
        timer: 1000,
        background: '#18181b',
        color: '#fff'
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isValidToken) {
    return (
      <div className="min-h-screen bg-black">
        <div className="relative py-20 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="max-w-md mx-auto">
              <div className="bg-black p-8 rounded border border-gray-700 shadow-xl text-center">
                <div className="text-red-500 text-4xl mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">
                  Invalid or Expired Link
                </h2>
                <p className="text-gray-300 mb-6">
                  This password reset link is invalid or has expired. Please request a new password reset link.
                </p>
                <Link to="/forgot-password" className="inline-block py-3 px-6 rounded-lg bg-twitch hover:bg-twitch-dark text-white font-medium transition-colors">
                  Request New Link
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="relative py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-md mx-auto">
            <div className="bg-black p-8 rounded border border-gray-700 shadow-xl">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-3">
                  Reset <span className="text-twitch">Password</span>
                </h2>
                <p className="text-gray-300">
                  Enter your new password below
                </p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      value={password}
                      onChange={handleChange}
                      placeholder="••••••••"
                      required
                      className="w-full p-3 rounded-lg bg-black border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-twitch"
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
                    Password must be at least 8 characters and include uppercase, lowercase, numbers, and special characters.
                  </p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      id="confirmPassword"
                      name="confirmPassword"
                      value={confirmPassword}
                      onChange={handleChange}
                      placeholder="••••••••"
                      required
                      className="w-full p-3 rounded-lg bg-black border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-twitch"
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

                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full py-3 rounded-lg font-medium transition-colors flex items-center justify-center ${isLoading ? 'bg-gray-600 cursor-not-allowed' : 'bg-twitch hover:bg-twitch-dark text-white'
                    }`}
                >
                  {isLoading ? (
                    <ClipLoader size={24} color="#9146FF" />
                  ) : (
                    "Reset Password"
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-gray-400">
                  Remember your password?{" "}
                  <Link to="/login" className="text-twitch hover:text-twitch-dark font-medium">
                    Sign in
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
