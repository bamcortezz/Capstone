import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ClipLoader } from "react-spinners";
import Swal from "sweetalert2";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleChange = (e) => {
    setEmail(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Password reset request failed');
      }

      setEmailSent(true);
      
      await Swal.fire({
        position: 'top-end',
        icon: 'success',
        title: 'Password Reset Email Sent!',
        text: 'Please check your email for reset instructions',
        toast: true,
        timerProgressBar: true,
        showConfirmButton: false,
        timer: 3000
      });

    } catch (err) {
      Swal.fire({
        position: 'top-end',
        icon: 'error',
        title: 'Password Reset Failed',
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
                  Forgot <span className="text-twitch">Password</span>
                </h2>
                <p className="text-gray-300">
                  {!emailSent 
                    ? "Enter your email to receive a password reset link" 
                    : "Check your email for password reset instructions"}
                </p>
              </div>

              {!emailSent ? (
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
                      placeholder="Email"
                      required
                      className="w-full p-3 rounded-lg bg-black border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-twitch"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full py-3 rounded-lg font-medium transition-colors flex items-center justify-center ${
                      isLoading ? 'bg-gray-600 cursor-not-allowed' : 'bg-twitch hover:bg-twitch-dark text-white'
                    }`}
                  >
                    {isLoading ? (
                      <ClipLoader size={24} color="#9146FF" />
                    ) : (
                      "Send Reset Link"
                    )}
                  </button>
                </form>              ) : (
                <div className="text-center">
                  <div className="mb-6 flex flex-col items-center">
                    <div className="w-20 h-20 mb-4 flex items-center justify-center rounded-full bg-green-100 text-green-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>                    <h3 className="text-xl font-medium text-white mb-2">Email Sent Successfully!</h3>
                    <div className="p-4 bg-black rounded-lg text-white mb-4">
                      <p className="mb-2">
                        A password reset link has been sent to:
                      </p>
                      <p className="font-bold mb-3 text-twitch">{email}</p>
                    </div>
                    <p className="text-gray-400 text-sm mb-4">
                      Didn't receive the email? Check your spam folder or try again.
                    </p>
                    <button
                      onClick={() => {
                        setEmail("");
                        setEmailSent(false);
                      }}
                      className="px-6 py-2 rounded-lg bg-twitch hover:bg-twitch-dark text-white font-medium transition-colors"
                    >
                      Try with a different email
                    </button>
                  </div>
                </div>
              )}

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

export default ForgotPassword;
