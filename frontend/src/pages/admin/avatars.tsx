import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Header from '@/components/Header';
import AdminNav from '@/components/AdminNav';
import { apiRequest, API_BASE_URL } from '@/lib/api';
import { getAuthSession, type AuthUser } from '@/lib/auth';

type AvatarRecord = {
  id: string;
  path: string;
  name: string;
};

export default function AdminAvatarsPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [avatars, setAvatars] = useState<AvatarRecord[]>([]);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [editingAvatar, setEditingAvatar] = useState<AvatarRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const session = getAuthSession();
    if (!session || session.user.role !== 'ADMIN') {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return;
    }

    setUser(session.user);
    void loadAvatars(session.token);
  }, []);

  const loadAvatars = async (token: string) => {
    setLoading(true);
    setError('');

    try {
      const data = await apiRequest<AvatarRecord[]>('/api/admin/avatars', { token });
      setAvatars(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load avatar library');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    const session = getAuthSession();
    if (!session) return;
    if (!editingAvatar && !file) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const formData = new FormData();
      if (name.trim()) {
        formData.append('name', name.trim());
      }
      if (file) {
        formData.append('avatar', file);
      }

      await apiRequest(editingAvatar ? `/api/admin/avatars/${editingAvatar.id}` : '/api/admin/avatars', {
        method: editingAvatar ? 'PUT' : 'POST',
        token: session.token,
        body: formData,
      });

      setName('');
      setFile(null);
      setEditingAvatar(null);
      setMessage(editingAvatar ? 'Avatar updated.' : 'Avatar uploaded.');
      await loadAvatars(session.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : editingAvatar ? 'Failed to update avatar' : 'Failed to upload avatar');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (avatar: AvatarRecord) => {
    setEditingAvatar(avatar);
    setName(avatar.name);
    setFile(null);
    setError('');
    setMessage('');
  };

  const handleCancelEdit = () => {
    setEditingAvatar(null);
    setName('');
    setFile(null);
  };

  const handleDelete = async (avatarID: string) => {
    const session = getAuthSession();
    if (!session) return;
    if (!window.confirm('Delete this avatar from the curated library?')) return;

    try {
      await apiRequest(`/api/admin/avatars/${avatarID}`, {
        method: 'DELETE',
        token: session.token,
      });
      setMessage('Avatar deleted.');
      await loadAvatars(session.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete avatar');
    }
  };

  return (
    <div className="admin-dashboard-page">
      <Head>
        <title>Avatar Library | Tech Hobby</title>
      </Head>

      <Header />

      <main className="admin-dashboard-shell">
        <AdminNav current="avatars" role={user?.role} />

        <header className="admin-page-header admin-avatar-page-header">
          <div>
            <span className="admin-dashboard-kicker">Admin</span>
            <h2>Curated avatar library.</h2>
            <p>Upload the approved profile imagery your members can select across the platform.</p>
          </div>
          <div className="admin-page-header-meta">
            <span>{avatars.length} assets</span>
          </div>
        </header>

        {error ? <p className="admin-page-feedback is-error">{error}</p> : null}
        {message ? <p className="admin-page-feedback is-success">{message}</p> : null}

        <section className="admin-management-layout admin-avatar-library-layout">
          <section className="admin-management-main admin-avatar-library-main">
            <div className="admin-management-head">
              <div>
                <span className="admin-dashboard-label">Gallery</span>
                <h2>{loading ? 'Loading avatar library' : `${avatars.length} approved avatars`}</h2>
              </div>
            </div>

            <div className="admin-avatar-grid">
              {avatars.map((avatar) => (
                <article key={avatar.id} className="admin-avatar-library-card">
                  <div className="admin-avatar-image-shell">
                    <img src={`${API_BASE_URL}${avatar.path}`} alt={avatar.name} />
                  </div>
                  <div className="admin-avatar-library-meta">
                    <strong>{avatar.name}</strong>
                    <div className="admin-avatar-library-actions">
                      <button type="button" onClick={() => handleEdit(avatar)}>
                        Edit
                      </button>
                      <button type="button" onClick={() => handleDelete(avatar.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="admin-management-sidebar admin-avatar-library-sidebar">
            <section className="admin-sidebar-section">
              <span className="admin-dashboard-label">Upload</span>
              <h3>{editingAvatar ? 'Edit avatar' : 'Add avatar'}</h3>
              <form onSubmit={handleUpload} className="admin-form-stack">
                <label className="admin-editor-field">
                  <span>Name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Sketch avatar 01"
                  />
                </label>
                <label className="admin-editor-field">
                  <span>Image File</span>
                  <div className="admin-file-input-shell">
                    <label className="admin-file-input-button">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => setFile(event.target.files?.[0] || null)}
                        required={!editingAvatar}
                      />
                      {editingAvatar ? 'Replace file' : 'Choose file'}
                    </label>
                    <span className={`admin-file-input-name${file ? ' has-file' : ''}`}>
                      {file ? file.name : editingAvatar ? 'Keep current image' : 'No file selected'}
                    </span>
                  </div>
                </label>
                <div className="admin-avatar-form-actions">
                  <button type="submit" className="admin-editor-publish" disabled={saving || (!editingAvatar && !file)}>
                    {saving ? (editingAvatar ? 'Saving...' : 'Uploading...') : editingAvatar ? 'Save Avatar' : 'Upload Avatar'}
                  </button>
                  {editingAvatar ? (
                    <button type="button" className="admin-avatar-secondary-button" onClick={handleCancelEdit}>
                      Cancel
                    </button>
                  ) : null}
                </div>
              </form>
            </section>
          </aside>
        </section>
      </main>
    </div>
  );
}
