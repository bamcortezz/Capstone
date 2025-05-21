// filepath: d:\Coding Practice\MongoDB\frontend\src\components\auth\Login.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ClipLoader } from "react-spinners";
import Swal from "sweetalert2";
import { useAuth } from "../../contexts/AuthContext";

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  const { email, password } = formData;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Use the login function from AuthContext
      await login(data.user);

      await Swal.fire({
        position: 'top-end',
        icon: 'success',
        title: 'Login successful!',
        text: `Welcome back, ${data.user.first_name}!`,
        toast: true,
        timerProgressBar: true,
        showConfirmButton: false,
        timer: 2000
      });

      // Navigate to the home page after successful login
      navigate('/');

    } catch (err) {
      Swal.fire({
        position: 'top-end',
        icon: 'error',
        title: 'Login Failed',
        text: err.message,
        toast: true,
        timerProgressBar: true,
        showConfirmButton: false,
        timer: 3000
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
                  Welcome <span className="text-twitch">Back</span>
                </h2>
                <p className="text-gray-300">
                  Sign in to continue analyzing Twitch chat sentiments
                </p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-6">
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
                    placeholder="you@example.com"
                    required
                    className="w-full p-3 rounded-lg bg-black border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-twitch"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    className="w-full p-3 rounded-lg bg-black border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-twitch"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="remember"
                      className="h-4 w-4 rounded border-gray-700 bg-black text-twitch focus:ring-twitch focus:ring-offset-black"
                    />
                    <label htmlFor="remember" className="ml-2 text-sm text-gray-400">
                      Remember me
                    </label>
                  </div>
                  <a href="#" className="text-sm text-twitch hover:text-twitch">
                    Forgot password?
                  </a>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full py-3 rounded-lg font-medium transition-colors flex items-center justify-center ${isLoading
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-twitch hover:bg-twitch-dark text-white'
                    }`}
                >
                  {isLoading ? (
                    <ClipLoader size={24} color="#9146FF" />
                  ) : (
                    "Sign In"
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;