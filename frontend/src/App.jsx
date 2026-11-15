import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Sidebar from './components/Sidebar.jsx';
import './styles/global.css';

// Lazy load route components for optimal production bundle splitting
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const CurrentZakat = lazy(() => import('./pages/CurrentZakat.jsx'));
const MissedZakat = lazy(() => import('./pages/MissedZakat.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));
const Auth = lazy(() => import('./pages/Auth.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));

// Page loading fallback component
const PageLoader = () => (
  <div style={{
    minHeight: '60vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    color: '#9ca3af'
  }}>
    <Loader2 className="spinning" size={38} style={{ color: '#f59e0b' }} />
    <span style={{ fontSize: '0.875rem', letterSpacing: '0.04em' }}>Loading...</span>
  </div>
);

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="app-container">
          <Sidebar />
          <div className="main-content">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public Authentication Routes */}
                <Route path="/auth" element={<Auth />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />

                {/* Protected User Routes (Require Authentication & Data Isolation) */}
                <Route 
                  path="/" 
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/current" 
                  element={
                    <ProtectedRoute>
                      <CurrentZakat />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/missed" 
                  element={
                    <ProtectedRoute>
                      <MissedZakat />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/profile" 
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  } 
                />

                {/* Admin Panel (Separate Administrative Access) */}
                <Route path="/admin" element={<Admin />} />
              </Routes>
            </Suspense>
          </div>
        </div>
      </AuthProvider>
    </Router>
  );
}
