import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Loader2, AlertCircle } from 'lucide-react';

export default function GoogleLoginButton({ mode = 'login', onSuccess }) {
  const { googleLogin, loading } = useAuth();
  const buttonRef = useRef(null);
  const [initError, setInitError] = useState(null);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const handleCredentialResponse = useCallback(async (response) => {
    if (!response || !response.credential) {
      setInitError('No credential received from Google.');
      return;
    }
    const result = await googleLogin(response.credential, mode);
    if (result && result.success && onSuccess) {
      onSuccess(result.user);
    }
  }, [googleLogin, mode, onSuccess]);

  useEffect(() => {
    if (!clientId) {
      return;
    }

    // Function to initialize Google button
    const initGoogleButton = () => {
      if (window.google?.accounts?.id && buttonRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true
          });

          // Render official Google button
          // mode === 'signup' renders "Sign up with Google", mode === 'login' renders "Continue with Google"
          window.google.accounts.id.renderButton(buttonRef.current, {
            type: 'standard',
            theme: 'filled_black',
            size: 'large',
            text: mode === 'signup' ? 'signup_with' : 'continue_with',
            shape: 'pill',
            width: 320,
            logo_alignment: 'center'
          });
        } catch (err) {
          console.error('Google Identity initialization error:', err);
          setInitError('Failed to initialize Google Sign-In.');
        }
      }
    };

    if (window.google?.accounts?.id) {
      initGoogleButton();
    } else {
      // Check every 200ms up to 5s for the script to load
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          initGoogleButton();
        }
      }, 200);

      const timeout = setTimeout(() => {
        clearInterval(interval);
        if (!window.google?.accounts?.id) {
          setInitError('Google Sign-In script could not be loaded.');
        }
      }, 5000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [clientId, mode, handleCredentialResponse]);

  // If Client ID is not configured yet, show a clear guidance card
  if (!clientId) {
    return (
      <div style={{
        background: 'rgba(245, 158, 11, 0.08)',
        border: '1px dashed #f59e0b',
        borderRadius: '12px',
        padding: '0.85rem',
        textAlign: 'center',
        fontSize: '0.8rem',
        color: '#f59e0b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        marginTop: '0.5rem'
      }}>
        <AlertCircle size={16} />
        <span>Add <code>VITE_GOOGLE_CLIENT_ID</code> to enable Google {mode === 'signup' ? 'Sign Up' : 'Sign In'}.</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', marginTop: '0.5rem' }}>
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#9ca3af', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
          <Loader2 size={16} className="spinning" />
          <span>{mode === 'signup' ? 'Creating account with Google...' : 'Signing in with Google...'}</span>
        </div>
      )}
      
      {initError && (
        <p style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '0.5rem' }}>{initError}</p>
      )}

      {/* Official Google Identity Button Mount */}
      <div 
        ref={buttonRef} 
        style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          width: '100%', 
          minHeight: '44px',
          opacity: loading ? 0.6 : 1,
          pointerEvents: loading ? 'none' : 'auto'
        }} 
      />
    </div>
  );
}
