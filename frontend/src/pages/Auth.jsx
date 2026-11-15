import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GoogleLoginButton from '../components/GoogleLoginButton';
import { 
  MoonStar, 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  Loader2, 
  ArrowRight 
} from 'lucide-react';
import '../styles/Auth.css';

// RFC-compliant email regex: rejects abc, test@, @gmail.com, user@gmail, user@@gmail.com
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, authError, setAuthError, loading } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Destination after successful login
  const from = location.state?.from?.pathname || '/';

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setLocalError('');
    if (authError) setAuthError(null);
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setLocalError('');
    if (authError) setAuthError(null);
    setFormData(prev => ({
      ...prev,
      password: '',
      name: newMode === 'login' ? '' : prev.name
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || isSubmitting) return;
    setLocalError('');
    if (authError) setAuthError(null);

    // 1. Email validation (both Sign Up and Log In)
    if (!formData.email || !formData.email.trim()) {
      setLocalError('Please enter your email address.');
      return;
    }
    const cleanEmail = formData.email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      setLocalError('Please enter a valid email address.');
      return;
    }

    // 2. Password presence and whitespace validation (both Sign Up and Log In)
    if (!formData.password) {
      setLocalError('Please enter your password.');
      return;
    }
    if (!formData.password.trim()) {
      setLocalError('Password cannot be empty or whitespace only.');
      return;
    }

    if (mode === 'register') {
      // 3. Full Name validation (Sign Up only)
      if (!formData.name || !formData.name.trim()) {
        setLocalError('Full name is required.');
        return;
      }
      const trimmedName = formData.name.trim();
      if (trimmedName.length < 2) {
        setLocalError('Full name must be at least 2 characters.');
        return;
      }
      if (trimmedName.length > 80) {
        setLocalError('Full name cannot exceed 80 characters.');
        return;
      }

      // 4. Password length validation for Sign Up
      if (formData.password.length < 8) {
        setLocalError('Password must be at least 8 characters long.');
        return;
      }
      if (formData.password.length > 128) {
        setLocalError('Password cannot exceed 128 characters.');
        return;
      }

      setIsSubmitting(true);
      try {
        const res = await register(trimmedName, cleanEmail, formData.password);
        if (res.success) {
          navigate(from, { replace: true });
        }
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Log In mode
      setIsSubmitting(true);
      try {
        const res = await login(cleanEmail, formData.password);
        if (res.success) {
          navigate(from, { replace: true });
        }
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleGoogleSuccess = () => {
    navigate(from, { replace: true });
  };

  const isBusy = loading || isSubmitting;

  return (
    <div className="auth-wrapper fade-up">
      <div className="auth-card">
        
        {/* Header */}
        <div className="auth-header">
          <div className="auth-logo-badge">
            <MoonStar size={26} color="#f59e0b" />
          </div>
          <h1 className="auth-title">
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="auth-subtitle">
            {mode === 'login' 
              ? 'Access your private calculations and Zakat history.' 
              : 'Begin tracking and purifying your wealth.'}
          </p>
        </div>

        {/* Tab switch */}
        <div className="auth-tabs">
          <button 
            type="button"
            className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => switchMode('login')}
          >
            Log In
          </button>
          <button 
            type="button"
            className={`auth-tab-btn ${mode === 'register' ? 'active' : ''}`}
            onClick={() => switchMode('register')}
          >
            Sign Up
          </button>
        </div>

        {/* Error message */}
        {(localError || authError) && (
          <div className="auth-error-banner">
            <AlertCircle size={18} />
            <span>{localError || authError}</span>
          </div>
        )}

        {/* Google Authentication (Dedicated Login or Sign Up mode) */}
        <GoogleLoginButton 
          key={mode}
          mode={mode === 'register' ? 'signup' : 'login'} 
          onSuccess={handleGoogleSuccess} 
        />

        <div className="auth-divider">
          <span>or continue with email</span>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleSubmit} noValidate>
          {mode === 'register' && (
            <div className="input-group">
              <label>Full Name</label>
              <div className="auth-input-wrapper">
                <User size={18} className="auth-input-icon" />
                <input
                  type="text"
                  name="name"
                  className="auth-input"
                  placeholder="e.g. Fatima Ali"
                  value={formData.name}
                  onChange={handleInputChange}
                  maxLength={80}
                  autoComplete="name"
                  required
                />
              </div>
            </div>
          )}

          <div className="input-group">
            <label>Email Address</label>
            <div className="auth-input-wrapper">
              <Mail size={18} className="auth-input-icon" />
              <input
                type="email"
                name="email"
                className="auth-input"
                placeholder="name@example.com"
                value={formData.email}
                onChange={handleInputChange}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label>Password</label>
            <div className="auth-input-wrapper">
              <Lock size={18} className="auth-input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                className="auth-input"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleInputChange}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
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
            {mode === 'register' && (
              <p className="auth-input-hint">Must be at least 8 characters.</p>
            )}
            {mode === 'login' && (
              <div className="auth-forgot-row">
                <Link to="/forgot-password" className="auth-forgot-link">
                  Forgot Password?
                </Link>
              </div>
            )}
          </div>

          <button 
            type="submit" 
            className="auth-submit-btn" 
            disabled={isBusy}
          >
            {isBusy ? (
              <>
                <Loader2 size={18} className="spinning" />
                <span>{mode === 'login' ? 'Signing In...' : 'Creating Account...'}</span>
              </>
            ) : (
              <>
                <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Switch prompt */}
        <div className="auth-footer">
          {mode === 'login' ? (
            <p>
              Don't have an account?{' '}
              <button 
                type="button" 
                className="auth-switch-link"
                onClick={() => switchMode('register')}
              >
                Create your account.
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button 
                type="button" 
                className="auth-switch-link"
                onClick={() => switchMode('login')}
              >
                Login.
              </button>
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
