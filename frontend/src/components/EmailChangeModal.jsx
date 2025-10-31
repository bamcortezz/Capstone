import React, { useState } from "react";
import Swal from "sweetalert2";

const API_URL = import.meta.env.VITE_API_URL;

const EmailChangeModal = ({
  isOpen,
  onClose,
  currentEmail,
  onEmailChanged,
  getAuthHeaders,
}) => {
  const [step, setStep] = useState(1); // 1: Request, 2: Verify Current, 3: Verify New
  const [formData, setFormData] = useState({
    newEmail: "",
    password: "",
    currentOtp: "",
    newOtp: "",
  });
  const [loading, setLoading] = useState(false);
  const [pendingNewEmail, setPendingNewEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const resetForm = () => {
    setFormData({
      newEmail: "",
      password: "",
      currentOtp: "",
      newOtp: "",
    });
    setStep(1);
    setPendingNewEmail("");
    setShowPassword(false);
  };

  const handleClose = async () => {
    if (step > 1) {
      const result = await Swal.fire({
        title: "Cancel Email Change?",
        text: "This will cancel your email change request.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#ef4444",
        cancelButtonColor: "#6B7280",
        confirmButtonText: "Yes, cancel",
        cancelButtonText: "Continue process",
        background: "#18181b",
        color: "#fff",
      });

      if (result.isConfirmed) {
        try {
          await fetch(`${API_URL}/api/user/change-email/cancel`, {
            method: "POST",
            headers: getAuthHeaders(),
          });
        } catch (error) {
          console.error("Error canceling email change:", error);
        }
        resetForm();
        onClose();
      }
    } else {
      resetForm();
      onClose();
    }
  };

  const handleRequestChange = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/user/change-email/request`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          new_email: formData.newEmail,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to request email change");
      }

      await Swal.fire({
        position: "top-end",
        icon: "success",
        title: "OTP Sent",
        text: `Verification code sent to ${currentEmail}`,
        toast: true,
        timerProgressBar: true,
        showConfirmButton: false,
        timer: 3000,
        confirmButtonColor: "#9147ff",
        background: "#18181b",
        color: "#fff",
      });

      setStep(2);
    } catch (error) {
      Swal.fire({
        position: "top-end",
        icon: "error",
        title: "Error",
        text: error.message,
        toast: true,
        timerProgressBar: true,
        showConfirmButton: false,
        timer: 3000,
        confirmButtonColor: "#9147ff",
        background: "#18181b",
        color: "#fff",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCurrentEmail = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/user/change-email/verify-current`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            otp: formData.currentOtp,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to verify OTP");
      }

      setPendingNewEmail(data.new_email);

      await Swal.fire({
        position: "top-end",
        icon: "success",
        title: "OTP Sent",
        text: `Verification code sent to ${data.new_email}`,
        toast: true,
        timerProgressBar: true,
        showConfirmButton: false,
        timer: 3000,
        confirmButtonColor: "#9147ff",
        background: "#18181b",
        color: "#fff",
      });

      setStep(3);
    } catch (error) {
      Swal.fire({
        position: "top-end",
        icon: "error",
        title: "Error",
        text: error.message,
        toast: true,
        timerProgressBar: true,
        showConfirmButton: false,
        timer: 3000,
        confirmButtonColor: "#9147ff",
        background: "#18181b",
        color: "#fff",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyNewEmail = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/user/change-email/verify-new`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            otp: formData.newOtp,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to verify OTP");
      }

      await Swal.fire({
        position: "top-end",
        icon: "success",
        title: "Email Changed",
        text: "Your email has been successfully updated!",
        toast: true,
        timerProgressBar: true,
        showConfirmButton: false,
        timer: 3000,
        confirmButtonColor: "#9147ff",
        background: "#18181b",
        color: "#fff",
      });

      onEmailChanged(data.user);
      resetForm();
      onClose();
    } catch (error) {
      Swal.fire({
        position: "top-end",
        icon: "error",
        title: "Error",
        text: error.message,
        toast: true,
        timerProgressBar: true,
        showConfirmButton: false,
        timer: 3000,
        confirmButtonColor: "#9147ff",
        background: "#18181b",
        color: "#fff",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg p-4 sm:p-6 md:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">
            Change Email
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-between mb-8 sm:mb-10 px-2 sm:px-4">
          <div className="flex flex-col items-center flex-1">
            <div
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-base sm:text-lg font-semibold ${
                step >= 1 ? "bg-twitch text-white" : "bg-gray-700 text-gray-400"
              }`}
            >
              1
            </div>
            <span className="text-xs sm:text-sm mt-2 sm:mt-3 text-gray-400 font-medium text-center">
              Request
            </span>
          </div>
          <div
            className={`flex-1 h-1 ${step >= 2 ? "bg-twitch" : "bg-gray-700"}`}
          ></div>
          <div className="flex flex-col items-center flex-1">
            <div
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-base sm:text-lg font-semibold ${
                step >= 2 ? "bg-twitch text-white" : "bg-gray-700 text-gray-400"
              }`}
            >
              2
            </div>
            <span className="text-xs sm:text-sm mt-2 sm:mt-3 text-gray-400 font-medium text-center">
              Verify Old
            </span>
          </div>
          <div
            className={`flex-1 h-1 ${step >= 3 ? "bg-twitch" : "bg-gray-700"}`}
          ></div>
          <div className="flex flex-col items-center flex-1">
            <div
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-base sm:text-lg font-semibold ${
                step >= 3 ? "bg-twitch text-white" : "bg-gray-700 text-gray-400"
              }`}
            >
              3
            </div>
            <span className="text-xs sm:text-sm mt-2 sm:mt-3 text-gray-400 font-medium text-center">
              Verify New
            </span>
          </div>
        </div>

        {/* Step 1: Request Change */}
        {step === 1 && (
          <form
            onSubmit={handleRequestChange}
            className="space-y-4 sm:space-y-6"
          >
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 sm:mb-3">
                Current Email
              </label>
              <input
                type="email"
                value={currentEmail}
                disabled
                className="w-full px-4 sm:px-5 py-2 sm:py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-500 cursor-not-allowed text-sm sm:text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 sm:mb-3">
                New Email
              </label>
              <input
                type="email"
                name="newEmail"
                value={formData.newEmail}
                onChange={handleChange}
                required
                placeholder="Enter new email address"
                className="w-full px-4 sm:px-5 py-2 sm:py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-twitch text-sm sm:text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 sm:mb-3">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="Enter your password"
                  className="w-full px-4 sm:px-5 py-2 sm:py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-twitch pr-12 sm:pr-14 text-sm sm:text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? (
                    <svg
                      className="w-5 h-5 sm:w-6 sm:h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5 sm:w-6 sm:h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-twitch hover:bg-twitch-dark text-white font-semibold py-2.5 sm:py-3 px-4 rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              {loading ? "Sending..." : "Send Verification Code"}
            </button>
          </form>
        )}

        {/* Step 2: Verify Current Email */}
        {step === 2 && (
          <form
            onSubmit={handleVerifyCurrentEmail}
            className="space-y-4 sm:space-y-6"
          >
            <p className="text-gray-300 mb-4 sm:mb-6 text-sm sm:text-base">
              We've sent a verification code to{" "}
              <span className="text-twitch font-medium">{currentEmail}</span>
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 sm:mb-3">
                Verification Code
              </label>
              <input
                type="text"
                name="currentOtp"
                value={formData.currentOtp}
                onChange={handleChange}
                required
                maxLength="6"
                placeholder="Enter 6-digit code"
                className="w-full px-4 sm:px-5 py-3 sm:py-4 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-twitch text-center text-2xl sm:text-3xl tracking-widest font-semibold"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-twitch hover:bg-twitch-dark text-white font-semibold py-2.5 sm:py-3 px-4 rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              {loading ? "Verifying..." : "Verify Code"}
            </button>
          </form>
        )}

        {/* Step 3: Verify New Email */}
        {step === 3 && (
          <form
            onSubmit={handleVerifyNewEmail}
            className="space-y-4 sm:space-y-6"
          >
            <p className="text-gray-300 mb-4 sm:mb-6 text-sm sm:text-base">
              We've sent a verification code to{" "}
              <span className="text-twitch font-medium">{pendingNewEmail}</span>
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 sm:mb-3">
                Verification Code
              </label>
              <input
                type="text"
                name="newOtp"
                value={formData.newOtp}
                onChange={handleChange}
                required
                maxLength="6"
                placeholder="Enter 6-digit code"
                className="w-full px-4 sm:px-5 py-3 sm:py-4 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-twitch text-center text-2xl sm:text-3xl tracking-widest font-semibold"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-twitch hover:bg-twitch-dark text-white font-semibold py-2.5 sm:py-3 px-4 rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              {loading ? "Verifying..." : "Complete Email Change"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default EmailChangeModal;
