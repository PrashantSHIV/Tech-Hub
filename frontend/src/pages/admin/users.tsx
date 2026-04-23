import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Header from '@/components/Header';
import AdminNav from '@/components/AdminNav';
import { apiRequest } from '@/lib/api';
import { getAuthSession, type AuthUser } from '@/lib/auth';

type UserRecord = {
  id: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  selected_avatar_id?: string | null;
  is_active: boolean;
  created_at?: string;
};

type AvatarRecord = {
  id: string;
  path: string;
  name: string;
};

type UserForm = {
  username: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'MEMBER';
  selected_avatar_id: string;
  is_active: boolean;
};

const initialForm: UserForm = {
  username: '',
  email: '',
  password: '',
  role: 'MEMBER',
  selected_avatar_id: '',
  is_active: true,
};

export default function AdminUsersPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [avatars, setAvatars] = useState<AvatarRecord[]>([]);
  const [form, setForm] = useState<UserForm>(initialForm);
  const [editingID, setEditingID] = useState<string | null>(null);
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
    void loadData(session.token);
  }, []);

  const loadData = async (token: string) => {
    setLoading(true);
    setError('');

    try {
      const [userData, avatarData] = await Promise.all([
        apiRequest<UserRecord[]>('/api/admin/users', { token }),
        apiRequest<AvatarRecord[]>('/api/admin/avatars', { token }),
      ]);
      setUsers(userData);
      setAvatars(avatarData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const setField = <K extends keyof UserForm>(field: K, value: UserForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm(initialForm);
    setEditingID(null);
  };

  const handleEdit = (record: UserRecord) => {
    setEditingID(record.id);
    setForm({
      username: record.username,
      email: record.email,
      password: '',
      role: record.role,
      selected_avatar_id: record.selected_avatar_id || '',
      is_active: record.is_active,
    });
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const session = getAuthSession();
    if (!session) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        username: form.username,
        email: form.email,
        password: form.password,
        role: form.role,
        selected_avatar_id: form.selected_avatar_id || null,
        is_active: form.is_active,
      };

      await apiRequest(editingID ? `/api/admin/users/${editingID}` : '/api/admin/users', {
        method: editingID ? 'PUT' : 'POST',
        token: session.token,
        json: payload,
      });

      setMessage(editingID ? 'User updated.' : 'User created.');
      resetForm();
      await loadData(session.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userID: string) => {
    const session = getAuthSession();
    if (!session) return;
    if (!window.confirm('Delete this user account?')) return;

    try {
      await apiRequest(`/api/admin/users/${userID}`, {
        method: 'DELETE',
        token: session.token,
      });
      setMessage('User deleted.');
      await loadData(session.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  return (
    <div className="admin-dashboard-page">
      <Head>
        <title>User Management | Tech Hobby</title>
      </Head>

      <Header />

      <main className="admin-dashboard-shell">
        <AdminNav current="users" role={user?.role} />

        <header className="admin-page-header">
          <div>
            <span className="admin-dashboard-kicker">Admin</span>
            <h1>User and role management.</h1>
            <p>Create new members or admins, assign curated avatars, and control account status.</p>
          </div>
          <div className="admin-page-header-meta">
            <span>{users.length} users</span>
            <span>{avatars.length} avatars</span>
          </div>
        </header>

        {error ? <p className="admin-page-feedback is-error">{error}</p> : null}
        {message ? <p className="admin-page-feedback is-success">{message}</p> : null}

        <section className="admin-management-layout">
          <section className="admin-management-main">
            <div className="admin-management-head">
              <div>
                <span className="admin-dashboard-label">Accounts</span>
                <h2>{loading ? 'Loading users' : `${users.length} team members`}</h2>
              </div>
            </div>

            <div className="admin-table">
              <div className="admin-table-head">
                <span>User</span>
                <span>Role</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              {users.map((record) => (
                <div key={record.id} className="admin-table-row">
                  <div>
                    <strong>{record.username}</strong>
                    <span>{record.email}</span>
                  </div>
                  <span>{record.role}</span>
                  <span>{record.is_active ? 'Active' : 'Inactive'}</span>
                  <div className="admin-table-actions">
                    <button type="button" onClick={() => handleEdit(record)}>
                      Edit
                    </button>
                    <button type="button" onClick={() => handleDelete(record.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="admin-management-sidebar">
            <section className="admin-sidebar-section">
              <span className="admin-dashboard-label">{editingID ? 'Edit User' : 'New User'}</span>
              <h3>{editingID ? 'Update account' : 'Create account'}</h3>
              <form onSubmit={handleSave} className="admin-form-stack">
                <label className="admin-editor-field">
                  <span>Username</span>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(event) => setField('username', event.target.value)}
                    required
                  />
                </label>
                <label className="admin-editor-field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setField('email', event.target.value)}
                    required
                  />
                </label>
                <label className="admin-editor-field">
                  <span>{editingID ? 'New Password' : 'Password'}</span>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) => setField('password', event.target.value)}
                    required={!editingID}
                  />
                </label>
                <label className="admin-editor-field">
                  <span>Role</span>
                  <select
                    className="admin-editor-select"
                    value={form.role}
                    onChange={(event) => setField('role', event.target.value as 'ADMIN' | 'MEMBER')}
                  >
                    <option value="MEMBER">MEMBER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </label>
                <label className="admin-editor-field">
                  <span>Curated Avatar</span>
                  <select
                    className="admin-editor-select"
                    value={form.selected_avatar_id}
                    onChange={(event) => setField('selected_avatar_id', event.target.value)}
                  >
                    <option value="">No avatar selected</option>
                    {avatars.map((avatar) => (
                      <option key={avatar.id} value={avatar.id}>
                        {avatar.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(event) => setField('is_active', event.target.checked)}
                  />
                  <span>Account is active</span>
                </label>

                <div className="admin-form-actions">
                  <button type="submit" className="admin-editor-publish" disabled={saving}>
                    {saving ? 'Saving...' : editingID ? 'Update User' : 'Create User'}
                  </button>
                  {editingID ? (
                    <button type="button" onClick={resetForm} className="admin-sidebar-link">
                      Cancel Edit
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
