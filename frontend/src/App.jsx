import React from "react"
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom"
import { ClipLoader } from "react-spinners"
import Login from "./components/auth/Login"
import Register from "./components/auth/Register"
import OTPVerification from "./components/auth/OTPVerification"
import ForgotPassword from "./components/auth/ForgotPassword"
import ResetPassword from "./components/auth/ResetPassword"
import Home from "./components/pages/Home"
import Contact from "./components/pages/Contact"
import About from "./components/pages/About"
import Analyze from "./components/pages/Analyze"
import History from "./components/pages/History"
import Settings from "./components/pages/Settings"
import AdminLayout from "./components/admin/layout/AdminLayout"
import Dashboard from "./components/admin/pages/Dashboard"
import Users from "./components/admin/pages/Users"
import Logs from "./components/admin/pages/Logs"
import Navbar from "./components/layout/Navbar"
import useBackendStatus from "./hooks/useBackendStatus"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import { AnalyzeProvider } from "./contexts/AnalyzeContext"
import AdminRoute from "./components/admin/AdminRoute"

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return children;
};

// Auth Route Component
const AuthRoute = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  
  if (user) {
    // Redirect admin
    if (user.role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/" replace />;
  }
  
  return children;
};

const AdminPages = () => {
  return (
    <AdminLayout>
      <Routes>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="users" element={<Users />} />
        <Route path="logs" element={<Logs />} />
      </Routes>
    </AdminLayout>
  );
};

// Wrapper component
const AppContent = () => {
  return (
    <div className="flex flex-col min-h-screen bg-black">
      <Routes>
        {/* Admin routes */}
        <Route
          path="/admin/*"
          element={
            <AdminRoute>
              <AdminPages />
            </AdminRoute>
          }
        />

        {/* Public routes */}
        <Route
          path="/*"
          element={
            <>
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
                  <Route 
                    path="/settings" 
                    element={
                      <ProtectedRoute>
                        <Settings />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/login" 
                    element={
                      <AuthRoute>
                        <Login />
                      </AuthRoute>
                    } 
                  />
                  <Route 
                    path="/register" 
                    element={
                      <AuthRoute>
                        <Register />
                      </AuthRoute>
                    } 
                  />
                  <Route path="/verify-otp" element={<OTPVerification />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password/:userId/:token" element={<ResetPassword />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            </>
          }
        />
      </Routes>
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
        <AnalyzeProvider>
          <AppContent />
        </AnalyzeProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
