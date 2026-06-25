import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TasksPage from './pages/TasksPage';
import NoticePage from './pages/NoticePage';
import AttendancePage from './pages/AttendancePage';
import AutomationsPage from './pages/AutomationsPage';
import ChatHubPage from './pages/ChatHubPage';
import BrainSpacePage from './pages/BrainSpacePage';
import PlacementPage from './pages/PlacementPage';
import StudyGroupsPage from './pages/StudyGroupsPage';
import DeadlinePlannerPage from './pages/DeadlinePlannerPage';
import KnowledgePage from './pages/KnowledgePage';
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import Spinner from './components/ui/Spinner';
import { Toaster } from 'react-hot-toast';

// Intercepts and guards routes when authentication session is not active
const ProtectedRoute = ({ children }) => {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0E1A]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <span className="text-white font-black text-base">CF</span>
          </div>
          <Spinner size="md" />
          <p className="text-xs text-white/30 font-medium">Loading CampusFlow...</p>
        </div>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Layout structure featuring fixed left-sidebar and responsive content body
const Layout = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-[#0A0E1A] dark:bg-[#0A0E1A] text-[#F8FAFC] dark:text-[#F8FAFC]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar />
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto max-w-screen-xl w-full mx-auto animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  const { token } = useAuth();

  return (
    <Router>
      <Toaster 
        position="top-right" 
        toastOptions={{
          style: {
            background: '#0F1629',
            color: '#F1F5F9',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
            fontWeight: '500',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          },
          duration: 4000,
          success: {
            iconTheme: { primary: '#34D399', secondary: '#0F1629' },
          },
          error: {
            iconTheme: { primary: '#F87171', secondary: '#0F1629' },
          },
        }} 
      />
      <Routes>
        <Route 
          path="/login" 
          element={token ? <Navigate to="/dashboard" replace /> : <LoginPage />} 
        />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Layout>
                <DashboardPage />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/tasks" 
          element={
            <ProtectedRoute>
              <Layout>
                <TasksPage />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/notice" 
          element={
            <ProtectedRoute>
              <Layout>
                <NoticePage />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/attendance" 
          element={
            <ProtectedRoute>
              <Layout>
                <AttendancePage />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/automations" 
          element={
            <ProtectedRoute>
              <Layout>
                <AutomationsPage />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/chat" 
          element={
            <ProtectedRoute>
              <Layout>
                <ChatHubPage />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/brainspace" 
          element={
            <ProtectedRoute>
              <Layout>
                <BrainSpacePage />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/placement" 
          element={
            <ProtectedRoute>
              <Layout>
                <PlacementPage />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/study-groups" 
          element={
            <ProtectedRoute>
              <Layout>
                <StudyGroupsPage />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/deadline-planner" 
          element={
            <ProtectedRoute>
              <Layout>
                <DeadlinePlannerPage />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/knowledge" 
          element={
            <ProtectedRoute>
              <Layout>
                <KnowledgePage />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route path="/" element={<Navigate to={token ? "/dashboard" : "/login"} replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
