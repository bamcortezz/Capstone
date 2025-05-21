import React from "react"
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom"
import { ClipLoader } from "react-spinners"
import Login from "./components/auth/Login"
import Register from "./components/auth/Register"
import OTPVerification from "./components/auth/OTPVerification"
import Home from "./components/pages/Home"
import Contact from "./components/pages/Contact"
import About from "./components/pages/About"
import Analyze from "./components/pages/Analyze"
import History from "./components/pages/History"
import Navbar from "./components/layout/Navbar"
import useBackendStatus from "./hooks/useBackendStatus"
import { AuthProvider, useAuth } from "./contexts/AuthContext"

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return children;
};

// Wrapper component
const AppContent = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <div className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} /> 
          <Route path="/contact" element={<Contact />} />
          <Route path="/about" element={<About />} />
          <Route path="/analyze" element={<Analyze />} />
          <Route 
            path="/history" 
            element={
              <ProtectedRoute>
                <History />
              </ProtectedRoute>
            } 
          />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-otp" element={<OTPVerification />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
};

function App() {
  const { isBackendReady, isChecking } = useBackendStatus();

  if (isChecking || !isBackendReady) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-black">
        <div className="text-twitch">
          <svg className="w-12 h-12 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
