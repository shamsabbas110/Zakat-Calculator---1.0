import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { resetPassword } from '../services/api';
import { 
  ShieldCheck, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowRight 
} from 'lucide-react';
import '../styles/Auth.css';

export default function ResetPassword() {
  const { token } = useParams();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setErrorMessage('');

    if (!token) {
      setErrorMessage('Reset token is missing or invalid.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter a new password.');
      return;
    }

    if (!password.trim()) {
      setErrorMessage('Password cannot be whitespace only.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (password.length > 128) {
      setErrorMessage('Password cannot exceed 128 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify both fields.');
      return;
    }

    setLoading(true);
    try {
      const res = await resetPassword(token, password);
      if (res.success) {
        setSuccess(true);
      } else {
        setErrorMessage(res.message || 'Unable to reset password.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'The reset link is invalid or has expired.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper fade-up">
      <div className="auth-card">
        
        {/* Header */}
        <div className="auth-header">
          <div className="auth-logo-badge">
            <ShieldCheck size={26} color="#f59e0b" />
          </div>
          <h1 className="auth-title">Set New Password</h1>
          <p className="auth-subtitle">
            Create a strong, secure password for your Zakat Calculator account.
          </p>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="auth-error-banner">
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {success ? (
          /* Success State */
          <div className="auth-success-card">
            <div className="auth-success-icon-wrapper">
              <CheckCircle2 size={36} color="#10b981" />
            </div>
            <h2 className="auth-success-title">Password Reset Complete</h2>
            <p className="auth-success-text">
              Your password has been successfully updated. All previous sessions have been securely revoked.
            </p>
            <p className="auth-success-subtext">
              You can now sign in with your new credentials.
            </p>

            <Link to="/auth" className="auth-submit-btn" style={{ textDecoration: 'none', marginTop: '1.5rem' }}>
              <span>Sign In Now</span>
              <ArrowRight size={18} />
            </Link>
          </div>
        ) : (
          /* Form State */
          <form onSubmit={handleSubmit} noValidate>
            <div className="input-group">
              <label>New Password</label>
              <div className="auth-input-wrapper">
                <Lock size={18} className="auth-input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  className="auth-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrorMessage(''); }}
                  autoComplete="new-password"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="auth-input-hint">Must be at least 8 characters.</p>
            </div>

            <div className="input-group">
              <label>Confirm New Password</label>
              <div className="auth-input-wrapper">
                <Lock size={18} className="auth-input-icon" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  className="auth-input"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setErrorMessage(''); }}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              className="auth-submit-btn" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="spinning" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <span>Reset Password</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            <div className="auth-footer" style={{ marginTop: '1.5rem' }}>
              <Link to="/auth" className="auth-back-link">
                <ArrowLeft size={16} />
                <span>Return to Sign In</span>
              </Link>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
