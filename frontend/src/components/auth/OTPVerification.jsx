import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ClipLoader } from "react-spinners";
import Swal from "sweetalert2";

// API URL
const API_URL = import.meta.env.VITE_API_URL;

const OTPVerification = () => {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(120); // 2 minutes
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email;

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  if (!email) {
    navigate("/register");
    return null;
  }

  const handleResendOTP = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/api/resend-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to resend code");
      }
      setTimeLeft(120); // Reset timer to 2 minutes
      await Swal.fire({
        position: "top-end",
        icon: "success",
        title: "New code sent!",
        toast: true,
        timerProgressBar: true,
        showConfirmButton: false,
        timer: 1000,
        confirmButtonColor: "#9147ff",
        background: "#18181b",
        color: "#fff",
      });
    } catch (error) {
      Swal.fire({
        position: "top-end",
        icon: "error",
        title: "Failed to resend code",
        text: error.message,
        toast: true,
        timerProgressBar: true,
        showConfirmButton: false,
        timer: 1000,
        confirmButtonColor: "#9147ff",
        background: "#18181b",
        color: "#fff",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (element, index) => {
    if (isNaN(element.value)) return false;

    setOtp([...otp.map((d, idx) => (idx === index ? element.value : d))]);

    // Focus next input
    if (element.value !== "") {
      if (index < 5) {
        element.nextElementSibling?.focus();
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const otpString = otp.join("");
      const response = await fetch(`${API_URL}/api/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, otp: otpString }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Verification failed");
      }

      await Swal.fire({
        position: "top-end",
        icon: "success",
        title: "Account Verified!",
        text: "Redirecting to login...",
        toast: true,
        timerProgressBar: true,
        showConfirmButton: false,
        timer: 1000,
        confirmButtonColor: "#9147ff",
        background: "#18181b",
        color: "#fff",
      });

      // Navigate to login after success
      setTimeout(() => {
        navigate("/login");
      }, 1000);
    } catch (err) {
      Swal.fire({
        position: "top-end",
        icon: "error",
        title: "Verification Failed",
        text: err.message,
        toast: true,
        timerProgressBar: true,
        showConfirmButton: false,
        timer: 1000,
        confirmButtonColor: "#9147ff",
        background: "#18181b",
        color: "#fff",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="relative py-12 sm:py-20 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-md mx-auto">
            <div className="bg-black p-4 sm:p-6 md:p-8 rounded border border-gray-700 shadow-xl">
              <div className="text-center mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                  Verify Your Email
                </h1>
                <p className="text-sm sm:text-base text-gray-400">
                  We sent a verification code to
                  <br />
                  <span className="text-twitch font-medium break-all">
                    {email}
                  </span>
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex justify-center gap-1.5 sm:gap-2">
                    {otp.map((data, index) => (
                      <input
                        key={index}
                        type="text"
                        maxLength="1"
                        value={data}
                        onChange={(e) => handleChange(e.target, index)}
                        onFocus={(e) => e.target.select()}
                        className="w-10 h-10 sm:w-12 sm:h-12 text-center text-lg sm:text-xl font-semibold rounded-lg bg-black border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-twitch"
                      />
                    ))}
                  </div>

                  <div className="text-center">
                    <p className="text-sm sm:text-base text-gray-400">
                      Time remaining: {Math.floor(timeLeft / 60)}:
                      {(timeLeft % 60).toString().padStart(2, "0")}
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || otp.some((digit) => digit === "")}
                  className={`w-full py-2.5 sm:py-3 rounded-lg font-medium transition-colors flex items-center justify-center text-sm sm:text-base ${
                    isLoading || otp.some((digit) => digit === "")
                      ? "bg-gray-600 cursor-not-allowed"
                      : "bg-twitch hover:bg-twitch-dark text-white"
                  }`}
                >
                  {isLoading ? (
                    <ClipLoader size={24} color="#9146FF" />
                  ) : (
                    "Verify Account"
                  )}
                </button>

                <div className="text-center">
                  <p className="text-sm sm:text-base text-gray-400">
                    Didn't receive the code?{" "}
                    <button
                      type="button"
                      onClick={handleResendOTP}
                      disabled={timeLeft > 0 || isLoading}
                      className={`text-twitch hover:text-twitch-dark font-medium ${
                        timeLeft > 0 || isLoading
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                    >
                      Resend Code
                    </button>
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OTPVerification;
