import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../services/api';
import { 
  KeyRound, 
  Mail, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowRight 
} from 'lucide-react';
import '../styles/Auth.css';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setErrorMessage('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!EMAIL_REGEX.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await forgotPassword(cleanEmail);
      if (res.success) {
        setSubmitted(true);
      } else {
        setErrorMessage(res.message || 'Unable to process request.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'An error occurred. Please try again.';
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
            <KeyRound size={26} color="#f59e0b" />
          </div>
          <h1 className="auth-title">Reset Password</h1>
          <p className="auth-subtitle">
            Enter your registered email address and we'll send you a secure link to reset your password.
          </p>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="auth-error-banner">
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {submitted ? (
          /* Confirmation State */
          <div className="auth-success-card">
            <div className="auth-success-icon-wrapper">
              <CheckCircle2 size={36} color="#10b981" />
            </div>
            <h2 className="auth-success-title">Check Your Inbox</h2>
            <p className="auth-success-text">
              If an account is associated with <strong>{email.trim().toLowerCase()}</strong>, we've sent instructions to reset your password.
            </p>
            <p className="auth-success-subtext">
              For security, this link is valid for <strong>15 minutes</strong>. Don't forget to check your spam or promotions folder.
            </p>

            <Link to="/auth" className="auth-submit-btn" style={{ textDecoration: 'none', marginTop: '1.5rem' }}>
              <ArrowLeft size={18} />
              <span>Back to Sign In</span>
            </Link>
          </div>
        ) : (
          /* Form State */
          <form onSubmit={handleSubmit} noValidate>
            <div className="input-group">
              <label>Email Address</label>
              <div className="auth-input-wrapper">
                <Mail size={18} className="auth-input-icon" />
                <input
                  type="email"
                  name="email"
                  className="auth-input"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrorMessage(''); }}
                  autoComplete="email"
                  autoFocus
                  required
                />
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
                  <span>Sending Link...</span>
                </>
              ) : (
                <>
                  <span>Send Reset Link</span>
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
