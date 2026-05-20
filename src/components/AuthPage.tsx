import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { supabaseConfigured } from '../lib/supabase';
import { Icon } from './Icon';

interface AuthPageProps {
  onBack: () => void;
  onSuccess: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,20}$/;

function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!pw) return { score: 0, label: '' };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  const label = ['Too short', 'Weak', 'OK', 'Strong', 'Excellent'][score];
  return { score: score as 0 | 1 | 2 | 3 | 4, label };
}

export function AuthPage({ onBack, onSuccess }: AuthPageProps) {
  const {
    authScreen,
    setAuthScreen,
    signIn,
    signUp,
    loading,
    error,
    notice,
    clearMessages,
  } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean; username?: boolean }>({});

  const isLogin = authScreen === 'login';
  const strength = useMemo(() => passwordStrength(password), [password]);

  const emailError =
    touched.email && email && !EMAIL_RE.test(email.trim())
      ? 'Enter a valid email address.'
      : null;

  const usernameError =
    !isLogin && touched.username && username && !USERNAME_RE.test(username.trim())
      ? '3–20 characters. Letters, numbers, dot, dash, underscore.'
      : null;

  const passwordError =
    touched.password && password && password.length < 6
      ? 'At least 6 characters.'
      : null;

  const formValid =
    EMAIL_RE.test(email.trim()) &&
    password.length >= 6 &&
    (isLogin || USERNAME_RE.test(username.trim()));

  const submit = async () => {
    setTouched({ email: true, password: true, username: true });
    if (!formValid) return;
    const ok = isLogin
      ? await signIn(email, password)
      : await signUp(email, password, username);
    if (ok) onSuccess();
  };

  const switchScreen = (next: 'login' | 'register') => {
    setAuthScreen(next);
    setTouched({});
  };

  return (
    <motion.div
      className="auth-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="glass-card auth-card"
        initial={{ y: 18, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 12, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      >
        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={isLogin}
            className={`auth-tab${isLogin ? ' active' : ''}`}
            onClick={() => switchScreen('login')}
          >
            Log in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isLogin}
            className={`auth-tab${!isLogin ? ' active' : ''}`}
            onClick={() => switchScreen('register')}
          >
            Register
          </button>
          <motion.span
            className="auth-tab-glider"
            animate={{ x: isLogin ? 0 : '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          />
        </div>

        <motion.h2 layout className="auth-title">
          {isLogin ? 'Welcome back' : 'Create your account'}
        </motion.h2>
        <p className="auth-subtitle">
          {isLogin
            ? 'Log in to play ranked matches and track your ELO.'
            : 'New players start at 500 ELO. Bot games don’t need an account.'}
        </p>

        {!supabaseConfigured && (
          <div className="banner banner-warning">
            Supabase isn’t configured. Add <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env</code>, then restart the dev
            server.
          </div>
        )}

        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          noValidate
        >
          <AnimatePresence mode="wait" initial={false}>
            {!isLogin && (
              <motion.label
                key="username"
                className="field"
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.22 }}
              >
                <span className="field-label">Username</span>
                <input
                  className={`glass-input${usernameError ? ' invalid' : ''}`}
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (error) clearMessages();
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, username: true }))}
                  placeholder="grandmaster_42"
                  autoComplete="username"
                  spellCheck={false}
                  maxLength={20}
                />
                {usernameError && <span className="field-error">{usernameError}</span>}
              </motion.label>
            )}
          </AnimatePresence>

          <label className="field">
            <span className="field-label">Email</span>
            <input
              className={`glass-input${emailError ? ' invalid' : ''}`}
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) clearMessages();
              }}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              placeholder="you@example.com"
              autoComplete="email"
              spellCheck={false}
            />
            {emailError && <span className="field-error">{emailError}</span>}
          </label>

          <label className="field">
            <span className="field-label">Password</span>
            <div className="input-wrap">
              <input
                className={`glass-input${passwordError ? ' invalid' : ''}`}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) clearMessages();
                }}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                placeholder={isLogin ? 'Your password' : 'At least 6 characters'}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                className="reveal-btn"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <Icon name={showPassword ? 'eye-off' : 'eye'} size={16} />
              </button>
            </div>
            {passwordError && <span className="field-error">{passwordError}</span>}
            {!isLogin && password.length > 0 && (
              <div className="strength" aria-hidden>
                <div className="strength-bars">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`strength-bar s${strength.score}${
                        i < strength.score ? ' on' : ''
                      }`}
                    />
                  ))}
                </div>
                <span className={`strength-label s${strength.score}`}>
                  {strength.label}
                </span>
              </div>
            )}
          </label>

          <AnimatePresence>
            {error && (
              <motion.div
                key={error}
                className="banner banner-error"
                role="alert"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {error}
              </motion.div>
            )}
            {notice && !error && (
              <motion.div
                key={notice}
                className="banner banner-info"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {notice}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="auth-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onBack}
              disabled={loading}
            >
              <Icon name="arrow-left" size={14} />
              <span>Back</span>
            </button>
            <motion.button
              type="submit"
              className="btn btn-primary auth-submit"
              disabled={loading || !supabaseConfigured}
              whileTap={{ scale: 0.97 }}
            >
              {loading ? (
                <span className="btn-spinner" aria-hidden />
              ) : isLogin ? (
                'Log in'
              ) : (
                'Create account'
              )}
            </motion.button>
          </div>
        </form>

        <p className="auth-switch">
          {isLogin ? (
            <>
              No account?{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => switchScreen('register')}
              >
                Register
              </button>
            </>
          ) : (
            <>
              Already have one?{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => switchScreen('login')}
              >
                Log in
              </button>
            </>
          )}
        </p>
      </motion.div>
    </motion.div>
  );
}
