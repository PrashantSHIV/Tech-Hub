import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { apiRequest } from '@/lib/api';
import { saveAuthSession, type AuthUser } from '@/lib/auth';

type LoginResponse = {
  token: string;
  user: AuthUser;
};

type ResetView = 'login' | 'request' | 'verify' | 'confirm';

export default function Login() {
  const router = useRouter();
  const [view, setView] = useState<ResetView>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const resetMessages = () => {
    setError('');
    setNotice('');
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const data = await apiRequest<LoginResponse>('/api/login', {
        method: 'POST',
        json: { identifier, password },
      });

      saveAuthSession(data);
      void router.push('/admin/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResetRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const data = await apiRequest<{ message: string }>('/api/password-reset/request', {
        method: 'POST',
        json: { identifier },
      });

      setNotice(`${data.message} Check the backend log for the OTP in development.`);
      setView('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request password reset');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      await apiRequest<{ valid: boolean }>('/api/password-reset/verify', {
        method: 'POST',
        json: { identifier, otp },
      });

      setNotice('OTP verified. Set the new password for this account.');
      setView('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const data = await apiRequest<{ message: string }>('/api/password-reset/confirm', {
        method: 'POST',
        json: { identifier, otp, new_password: newPassword },
      });

      setPassword('');
      setOtp('');
      setNewPassword('');
      setView('login');
      setNotice(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const switchView = (nextView: ResetView) => {
    resetMessages();
    setView(nextView);
  };

  return (
    <div className="admin-auth-page">
      <Head>
        <title>Admin Login | Tech Hobby</title>
      </Head>

      <main className="admin-auth-shell">
        <section className="admin-auth-intro">
          <Link href="/" className="admin-auth-brand">
            Tech Hobby
          </Link>
          <div className="admin-auth-hero-image">
            <img src="/kid.jpg" alt="Kid illustration" />
          </div>
        </section>

        <section className="admin-auth-panel">
          <div className="admin-auth-panel-head">
            <span className="admin-auth-kicker">
              {view === 'login' ? 'Sign In' : 'Password Reset'}
            </span>
            <h2>
              {view === 'login' && 'Access the workspace'}
              {view === 'request' && 'Request reset OTP'}
              {view === 'verify' && 'Verify reset code'}
              {view === 'confirm' && 'Create a new password'}
            </h2>
          </div>

          {error ? <p className="admin-auth-feedback is-error">{error}</p> : null}
          {notice ? <p className="admin-auth-feedback is-success">{notice}</p> : null}

          {view === 'login' ? (
            <form onSubmit={handleLogin} className="admin-auth-form">
              <label className="admin-auth-field">
                <span>Username or Email</span>
                <input
                  type="text"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="admin@example.com"
                  required
                />
              </label>

              <label className="admin-auth-field">
                <span>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </label>

              <button type="submit" className="admin-auth-submit" disabled={loading}>
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
          ) : null}

          {view === 'request' ? (
            <form onSubmit={handleResetRequest} className="admin-auth-form">
              <label className="admin-auth-field">
                <span>Username or Email</span>
                <input
                  type="text"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="member@example.com"
                  required
                />
              </label>

              <button type="submit" className="admin-auth-submit" disabled={loading}>
                {loading ? 'Generating OTP...' : 'Send Reset OTP'}
              </button>
            </form>
          ) : null}

          {view === 'verify' ? (
            <form onSubmit={handleVerifyOTP} className="admin-auth-form">
              <label className="admin-auth-field">
                <span>Username or Email</span>
                <input
                  type="text"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  required
                />
              </label>

              <label className="admin-auth-field">
                <span>6-digit OTP</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  placeholder="123456"
                  required
                />
              </label>

              <button type="submit" className="admin-auth-submit" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>
            </form>
          ) : null}

          {view === 'confirm' ? (
            <form onSubmit={handleConfirmReset} className="admin-auth-form">
              <label className="admin-auth-field">
                <span>Username or Email</span>
                <input
                  type="text"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  required
                />
              </label>

              <label className="admin-auth-field">
                <span>OTP</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  required
                />
              </label>

              <label className="admin-auth-field">
                <span>New Password</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Choose a new password"
                  required
                />
              </label>

              <button type="submit" className="admin-auth-submit" disabled={loading}>
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          ) : null}

          <div className="admin-auth-footer">
            {view === 'login' ? (
              <button type="button" onClick={() => switchView('request')} className="admin-auth-link">
                Forgot password?
              </button>
            ) : (
              <button type="button" onClick={() => switchView('login')} className="admin-auth-link">
                Back to sign in
              </button>
            )}
            {view === 'verify' ? (
              <button type="button" onClick={() => switchView('request')} className="admin-auth-link">
                Request another OTP
              </button>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
