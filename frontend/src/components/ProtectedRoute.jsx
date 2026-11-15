import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '80vh',
        gap: '1rem'
      }}>
        <Loader2 className="spinning" size={42} style={{ color: '#f59e0b' }} />
        <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Verifying your session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login page and remember current location for post-login redirect
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return children;
}
