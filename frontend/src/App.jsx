import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/layout/Layout';

import LandingPage from './pages/LandingPage';
import FeedPage from './pages/FeedPage';
import AITutorPage from './pages/AITutorPage';
import ProfilePage from './pages/ProfilePage';
import LeaderboardPage from './pages/LeaderboardPage';
import ProofsPage from './pages/ProofsPage';
import StudioPage from './pages/StudioPage';
import LibraryPage from './pages/LibraryPage';
import GroupsPage from './pages/GroupsPage';
import CompetitionsPage from './pages/CompetitionsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import MeetPage from './pages/MeetPage';
import { ProtectedRoute, PublicOnlyRoute } from './components/common/ProtectedRoute';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Crash in module:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', color: '#EF4444' }}>
          <h2>Something went wrong in this module.</h2>
          <p style={{ color: 'var(--text-muted)' }}>{this.state.error?.message || 'Unknown runtime error'}</p>
          <button 
            onClick={() => this.setState({ hasError: false })}
            className="btn-primary" 
            style={{ marginTop: '16px' }}
          >
            Reload Module
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <ErrorBoundary>
            <Routes>
              {/* Public Landing Page */}
              <Route path="/" element={<LandingPage />} />

              {/* Protected Features - Accessible Only After Authentication */}
              <Route path="/feed" element={<ProtectedRoute><FeedPage /></ProtectedRoute>} />
              <Route path="/competitions" element={<ProtectedRoute><CompetitionsPage /></ProtectedRoute>} />
              <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
              <Route path="/proofs" element={<ProtectedRoute><ProofsPage /></ProtectedRoute>} />
              <Route path="/studio" element={<ProtectedRoute><ProofsPage /></ProtectedRoute>} />
              <Route path="/formulas" element={<ProtectedRoute><StudioPage /></ProtectedRoute>} />
              <Route path="/tutor" element={<ProtectedRoute><AITutorPage /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              <Route path="/library" element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
              <Route path="/groups" element={<ProtectedRoute><GroupsPage /></ProtectedRoute>} />
              <Route path="/meet/:meetingCode" element={<ProtectedRoute><MeetPage /></ProtectedRoute>} />

              {/* Auth Routes - Hidden Navbar & BottomNav, Accessible When Logged Out */}
              <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
              <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
              <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
              <Route path="/download" element={<DownloadPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ErrorBoundary>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
