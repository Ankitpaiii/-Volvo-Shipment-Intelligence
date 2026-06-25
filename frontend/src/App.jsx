import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import IntroPage from './pages/IntroPage';
import OnboardingPage from './pages/OnboardingPage';
import DashboardPage from './pages/DashboardPage';
import AcademicsPage from './pages/AcademicsPage';
import CareerPage from './pages/CareerPage';
import CopilotPage from './pages/CopilotPage';
import AutomationsPage from './pages/AutomationsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { Toaster } from 'react-hot-toast';

import { AnimatePresence } from 'framer-motion';
import PageTransition from './components/layout/PageTransition';
import { useAuth } from './context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><IntroPage /></PageTransition>} />
        <Route path="/login" element={<PageTransition><LoginPage /></PageTransition>} />
        <Route path="/register" element={<PageTransition><RegisterPage /></PageTransition>} />
        <Route path="/onboarding" element={<PageTransition><OnboardingPage /></PageTransition>} />
        <Route path="/dashboard" element={<ProtectedRoute><PageTransition><DashboardPage /></PageTransition></ProtectedRoute>} />
        <Route path="/academics" element={<ProtectedRoute><PageTransition><AcademicsPage /></PageTransition></ProtectedRoute>} />
        <Route path="/career" element={<ProtectedRoute><PageTransition><CareerPage /></PageTransition></ProtectedRoute>} />
        <Route path="/copilot" element={<ProtectedRoute><PageTransition><CopilotPage /></PageTransition></ProtectedRoute>} />
        <Route path="/automations" element={<ProtectedRoute><PageTransition><AutomationsPage /></PageTransition></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <Router>
      <Toaster 
        position="bottom-right" 
        toastOptions={{
          className: 'bg-surface/80 backdrop-blur-xl text-primary border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.1)] rounded-[1.25rem]',
          duration: 4000
        }} 
      />
      <AnimatedRoutes />
    </Router>
  );
}
