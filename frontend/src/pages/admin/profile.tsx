import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Header from '@/components/Header';
import AdminNav from '@/components/AdminNav';
import { apiRequest, API_BASE_URL } from '@/lib/api';
import {
  getAuthSession,
  updateStoredUser,
  type AuthUser,
} from '@/lib/auth';

type AvatarRecord = {
  id: string;
  path: string;
  name: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [avatars, setAvatars] = useState<AvatarRecord[]>([]);
  const [selectedAvatarID, setSelectedAvatarID] = useState('');
  const [loading, setLoading] = useState(true);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileUsername, setProfileUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const session = getAuthSession();
    if (!session) {
      void router.push('/login');
      return;
    }

    setUser(session.user);
    setSelectedAvatarID(session.user.selected_avatar_id || '');
    setProfileUsername(session.user.username || '');
    void loadAvatars(session.token);
  }, [router]);

  const loadAvatars = async (token: string) => {
    setLoading(true);
    setError('');

    try {
      const data = await apiRequest<AvatarRecord[]>('/api/avatars', { token });
      setAvatars(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load avatar library');
      setAvatars([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAvatar = async () => {
    const session = getAuthSession();
    if (!session) {
      void router.push('/login');
      return;
    }

    if (!selectedAvatarID) {
      setError('Select an avatar before saving.');
      return;
    }

    setAvatarSaving(true);
    setError('');
    setMessage('');

    try {
      await apiRequest<{ message: string }>('/api/me/avatar', {
        method: 'PUT',
        token: session.token,
        json: { selected_avatar_id: selectedAvatarID },
      });

      const nextUser = {
        ...session.user,
        selected_avatar_id: selectedAvatarID,
      };
      updateStoredUser(nextUser);
      setUser(nextUser);
      setMessage('Avatar selection updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update avatar');
    } finally {
      setAvatarSaving(false);
    }
  };

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();

    const session = getAuthSession();
    if (!session) {
      void router.push('/login');
      return;
    }

    if (!profileUsername.trim()) {
      setError('Name is required.');
      return;
    }

    if (!currentPassword.trim()) {
      setError('Current password is required.');
      return;
    }

    setProfileSaving(true);
    setError('');
    setMessage('');

    try {
      const data = await apiRequest<{ message: string; user: AuthUser }>('/api/me/profile', {
        method: 'PUT',
        token: session.token,
        json: {
          username: profileUsername.trim(),
          current_password: currentPassword,
          new_password: newPassword,
        },
      });

      updateStoredUser(data.user);
      setUser(data.user);
      setProfileUsername(data.user.username);
      setCurrentPassword('');
      setNewPassword('');
      setMessage('Profile details updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <div className="admin-dashboard-page">
      <Head>
        <title>Profile | Tech Hobby</title>
      </Head>

      <Header />

      <main className="admin-dashboard-shell">
        <AdminNav current="profile" role={user?.role} />

        <header className="admin-page-header">
          <div>
            <span className="admin-dashboard-kicker">Profile</span>
            <h2>Choose a curated avatar.</h2>
            <p>
              Members can only select from the approved library. Admins can manage the full
              gallery from the avatar library screen.
            </p>
          </div>
          <div className="admin-page-header-meta">
            <span>{user?.username}</span>
            <span>{user?.email}</span>
            <span>{user?.role}</span>
          </div>
        </header>

        {error ? <p className="admin-page-feedback is-error">{error}</p> : null}
        {message ? <p className="admin-page-feedback is-success">{message}</p> : null}

        <section className="admin-management-layout admin-profile-layout">
          <section className="admin-management-main admin-profile-main">
            <div className="admin-management-head">
              <div>
                <span className="admin-dashboard-label">Avatar Library</span>
                <h2>{loading ? 'Loading avatars' : `${avatars.length} curated options`}</h2>
              </div>
            </div>

            {loading ? (
              <p className="admin-dashboard-empty">Loading avatar library...</p>
            ) : (
              <div className="admin-avatar-grid">
                {avatars.map((avatar) => (
                  <button
                    key={avatar.id}
                    type="button"
                    className={`admin-avatar-card${selectedAvatarID === avatar.id ? ' is-selected' : ''}`}
                    onClick={() => setSelectedAvatarID(avatar.id)}
                  >
                    <div className="admin-avatar-image-shell">
                      <img src={`${API_BASE_URL}${avatar.path}`} alt={avatar.name} />
                    </div>
                    <span>{avatar.name}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <aside className="admin-management-sidebar admin-profile-sidebar">
            <section className="admin-sidebar-section">
              <span className="admin-dashboard-label">Selection</span>
              <h3>Current avatar</h3>
              <p>Pick one image and save it to your account profile.</p>
              <button
                type="button"
                onClick={handleSaveAvatar}
                disabled={avatarSaving}
                className="admin-editor-publish"
              >
                {avatarSaving ? 'Saving...' : 'Save Avatar'}
              </button>
            </section>

            <section className="admin-sidebar-section">
              <span className="admin-dashboard-label">Account</span>
              <h3>Update profile</h3>
              <p>Change your display name or set a new password. Current password is required.</p>
              <form onSubmit={handleSaveProfile} className="admin-form-stack">
                <label className="admin-editor-field">
                  <span>Name</span>
                  <input
                    type="text"
                    value={profileUsername}
                    onChange={(event) => setProfileUsername(event.target.value)}
                    required
                  />
                </label>
                <label className="admin-editor-field">
                  <span>Current Password</span>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    required
                  />
                </label>
                <label className="admin-editor-field">
                  <span>New Password</span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Leave empty to keep current password"
                  />
                </label>
                <button type="submit" disabled={profileSaving} className="admin-editor-publish">
                  {profileSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </form>
            </section>
          </aside>
        </section>
      </main>
    </div>
  );
}
