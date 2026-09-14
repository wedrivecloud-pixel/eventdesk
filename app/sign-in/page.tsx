'use client';

import { useState, useSyncExternalStore, type SyntheticEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { createAuthClient } from 'better-auth/react';
import { AppLogo } from '@/components/app-logo';
import { SignupPlanSummary } from '@/components/marketing/signup-plan';
import './sign-in.css';

const auth = createAuthClient();
type Mode = 'signin' | 'signup' | 'forgot';
function subscribe(callback: () => void) {
  window.addEventListener('popstate', callback);
  return () => window.removeEventListener('popstate', callback);
}
function field(data: FormData, name: string) {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
}

export default function SignIn() {
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => '',
  );
  const query = new URLSearchParams(search);
  const token = query.get('token');
  const resetting = query.has('token');
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null);
  const mode =
    selectedMode ?? (query.get('mode') === 'signup' ? 'signup' : 'signin');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [hasError, setHasError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function changeMode(next: Mode) {
    setSelectedMode(next);
    setMessage('');
    setHasError(false);
    setShowPassword(false);
  }

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage('');
    setHasError(false);
    const data = new FormData(event.currentTarget);
    const email = field(data, 'email'),
      password = field(data, 'password');
    let next = query.get('return_to') || '/app';
    if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\'))
      next = '/app';
    try {
      if (resetting && !token) throw Error('Invalid reset link');
      const result = resetting
        ? await auth.resetPassword({ token: token!, newPassword: password })
        : mode === 'signup'
          ? await auth.signUp.email({
              email,
              password,
              name: field(data, 'name'),
              callbackURL: next,
            })
          : mode === 'forgot'
            ? await auth.requestPasswordReset({
                email,
                redirectTo: location.origin + '/sign-in',
              })
            : await auth.signIn.email({
                email,
                password,
                callbackURL: next,
                rememberMe: data.get('remember') === 'on',
              });
      if (result.error) {
        setHasError(true);
        setMessage(
          result.error.message || 'Unable to continue. Please try again.',
        );
      } else if (resetting) {
        history.replaceState(null, '', '/sign-in');
        window.dispatchEvent(new PopStateEvent('popstate'));
        setSelectedMode('signin');
        setShowPassword(false);
        setMessage('Password updated. You can sign in.');
      } else if (mode === 'signin') {
        location.assign(next);
      } else {
        setMessage(
          mode === 'signup'
            ? 'Check your email to verify your account.'
            : 'If an account exists, a password reset email is on its way.',
        );
      }
    } catch {
      setHasError(true);
      setMessage(
        resetting && !token
          ? 'This reset link is invalid. Request a new one from the login screen.'
          : 'Sign-in is temporarily unavailable. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  const title = resetting
    ? 'Set a new password'
    : mode === 'signup'
      ? 'Make room for great events.'
      : mode === 'forgot'
        ? 'Forgot your password?'
        : 'Welcome back.';
  const description = resetting
    ? 'Choose a secure password for your EventDeskly account.'
    : mode === 'signup'
      ? 'Create your account and bring your business together.'
      : mode === 'forgot'
        ? 'Enter your email and we’ll send you a reset link.'
        : 'Your events, clients, and next big ideas are waiting.';

  return (
    <main className="ed-auth">
      <section className="ed-auth-brand" aria-label="About EventDeskly">
        <Link
          className="ed-auth-brand-logo"
          href="/welcome"
          aria-label="EventDeskly home"
        >
          <AppLogo />
        </Link>
        <div className="ed-auth-story">
          <span className="ed-auth-eyebrow">
            <Sparkles size={16} aria-hidden="true" /> MADE FOR EVENT
            PROFESSIONALS
          </span>
          <h2>
            Great events.
            <br />
            Less busywork.
            <br />
            <span>More possibilities.</span>
          </h2>
          <p>
            Bring your leads, bookings, and event details together. Get back to
            the work you love.
          </p>
          <div className="ed-auth-illustration" aria-hidden="true">
            <div className="ed-auth-orbit" />
            <div className="ed-auth-event-card">
              <div className="ed-auth-calendar">
                <CalendarDays size={30} strokeWidth={1.5} />
              </div>
              <div>
                <span>EVERY DETAIL, IN PLACE</span>
                <strong>Ready for your next event.</strong>
                <div className="ed-auth-card-lines">
                  <i />
                  <i />
                </div>
              </div>
              <span className="ed-auth-card-check">
                <Check size={17} />
              </span>
            </div>
            <div className="ed-auth-note">
              <span>
                <Check size={14} />
              </span>{' '}
              A clearer plan. A calmer day.
            </div>
          </div>
        </div>
        <p className="ed-auth-brand-footer">
          Your events. Your business. All together.
        </p>
      </section>

      <section className="ed-auth-main" aria-labelledby="auth-title">
        <Link className="ed-auth-home" href="/welcome">
          <ArrowLeft size={16} aria-hidden="true" /> Back to website
        </Link>
        <div className="ed-auth-form-wrap">
          <Link
            className="ed-auth-logo"
            href="/welcome"
            aria-label="EventDeskly home"
          >
            <AppLogo />
          </Link>
          {!resetting && mode !== 'forgot' && (
            <fieldset className="ed-auth-switch" aria-label="Account access">
              <button
                type="button"
                aria-pressed={mode === 'signin'}
                disabled={busy}
                onClick={() => changeMode('signin')}
              >
                Log in
              </button>
              <button
                type="button"
                aria-pressed={mode === 'signup'}
                disabled={busy}
                onClick={() => changeMode('signup')}
              >
                Sign up
              </button>
            </fieldset>
          )}
          <header className="ed-auth-heading">
            <h1 id="auth-title">{title}</h1>
            <p>{description}</p>
          </header>
          {mode === 'signup' && !resetting && <SignupPlanSummary />}
          <form
            key={resetting ? 'reset' : mode}
            onSubmit={submit}
            aria-busy={busy}
            className="ed-auth-form"
          >
            <fieldset disabled={busy}>
              {mode === 'signup' && !resetting && (
                <div className="ed-auth-field">
                  <label htmlFor="auth-name">Your name</label>
                  <div className="ed-auth-input">
                    <UserRound size={19} aria-hidden="true" />
                    <input
                      id="auth-name"
                      name="name"
                      autoComplete="name"
                      placeholder="First and last name"
                      required
                      maxLength={100}
                    />
                  </div>
                </div>
              )}
              {!resetting && (
                <div className="ed-auth-field">
                  <label htmlFor="auth-email">Email address</label>
                  <div className="ed-auth-input">
                    <Mail size={19} aria-hidden="true" />
                    <input
                      id="auth-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@yourbusiness.com"
                      required
                      maxLength={254}
                    />
                  </div>
                </div>
              )}
              {(mode !== 'forgot' || resetting) && (
                <div className="ed-auth-field">
                  <label htmlFor="auth-password">
                    {resetting ? 'New password' : 'Password'}
                  </label>
                  <div className="ed-auth-input">
                    <LockKeyhole size={19} aria-hidden="true" />
                    <input
                      id="auth-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={
                        mode === 'signin' && !resetting
                          ? 'current-password'
                          : 'new-password'
                      }
                      placeholder={
                        mode === 'signup' || resetting
                          ? 'Create a secure password'
                          : 'Enter your password'
                      }
                      minLength={12}
                      maxLength={128}
                      required
                      aria-describedby={
                        mode === 'signup' || resetting
                          ? 'auth-password-help'
                          : undefined
                      }
                    />
                    <button
                      type="button"
                      className="ed-auth-reveal"
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff size={19} aria-hidden="true" />
                      ) : (
                        <Eye size={19} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  {(mode === 'signup' || resetting) && (
                    <p className="ed-auth-hint" id="auth-password-help">
                      Use at least 12 characters.
                    </p>
                  )}
                </div>
              )}
              {mode === 'signin' && !resetting && (
                <div className="ed-auth-options">
                  <label className="ed-auth-remember">
                    <input name="remember" type="checkbox" defaultChecked />{' '}
                    Remember me
                  </label>
                  <button
                    type="button"
                    className="ed-auth-link"
                    onClick={() => changeMode('forgot')}
                  >
                    Forgot password?
                  </button>
                </div>
              )}
              <button type="submit" className="ed-auth-submit">
                {busy
                  ? 'Please wait…'
                  : resetting
                    ? 'Save new password'
                    : mode === 'signup'
                      ? 'Create account'
                      : mode === 'forgot'
                        ? 'Send reset link'
                        : 'Sign in'}
                {!busy && <ArrowRight size={18} aria-hidden="true" />}
              </button>
            </fieldset>
            {message && (
              <p
                className={
                  hasError ? 'ed-auth-message ed-auth-error' : 'ed-auth-message'
                }
                role={hasError ? 'alert' : 'status'}
              >
                {message}
              </p>
            )}
          </form>
          {(mode === 'forgot' || resetting) && (
            <div className="ed-auth-return">
              {resetting ? (
                <Link href="/sign-in" className="ed-auth-link">
                  <ArrowLeft size={15} aria-hidden="true" /> Back to login
                </Link>
              ) : (
                <button
                  type="button"
                  className="ed-auth-link"
                  disabled={busy}
                  onClick={() => changeMode('signin')}
                >
                  <ArrowLeft size={15} aria-hidden="true" /> Back to login
                </button>
              )}
            </div>
          )}
          <p className="ed-auth-secure">
            <ShieldCheck size={16} aria-hidden="true" /> Your workspace,
            securely connected.
          </p>
        </div>
        <p className="ed-auth-footer">
          Made for the people who make events happen.
        </p>
      </section>
    </main>
  );
}
