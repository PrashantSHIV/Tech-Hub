import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Header from '@/components/Header';
import AdminNav from '@/components/AdminNav';
import { apiRequest } from '@/lib/api';
import { getAuthSession, type AuthUser } from '@/lib/auth';

type CategoryRecord = {
  id: string;
  name: string;
  created_by: string;
  created_by_name?: string;
  doc_count: number;
  can_manage: boolean;
  created_at?: string;
  updated_at?: string;
};

export default function AdminCategoriesPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [name, setName] = useState('');
  const [editingCategory, setEditingCategory] = useState<CategoryRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const session = getAuthSession();
    if (!session) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return;
    }

    setUser(session.user);
    void loadCategories(session.token);
  }, []);

  const loadCategories = async (token: string) => {
    setLoading(true);
    setError('');

    try {
      const data = await apiRequest<CategoryRecord[]>('/api/admin/categories', { token });
      setCategories(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setEditingCategory(null);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const session = getAuthSession();
    if (!session) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      await apiRequest(editingCategory ? `/api/admin/categories/${editingCategory.id}` : '/api/admin/categories', {
        method: editingCategory ? 'PUT' : 'POST',
        token: session.token,
        json: { name },
      });

      setMessage(editingCategory ? 'Category updated.' : 'Category created.');
      resetForm();
      await loadCategories(session.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (category: CategoryRecord) => {
    setEditingCategory(category);
    setName(category.name);
    setError('');
    setMessage('');
  };

  const handleDelete = async (category: CategoryRecord) => {
    const session = getAuthSession();
    if (!session) return;
    if (!window.confirm(`Delete category "${category.name}"?`)) return;

    try {
      await apiRequest(`/api/admin/categories/${category.id}`, {
        method: 'DELETE',
        token: session.token,
      });
      setMessage('Category deleted.');
      await loadCategories(session.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category');
    }
  };

  return (
    <div className="admin-dashboard-page">
      <Head>
        <title>Categories | Tech Hobby</title>
      </Head>

      <Header />

      <main className="admin-dashboard-shell">
        <AdminNav current="categories" role={user?.role} />

        <header className="admin-page-header">
          <div>
            <span className="admin-dashboard-kicker">Workspace</span>
            <h2>Documentation categories.</h2>
            <p>Create shared categories for the editor dropdown. Members can manage their own categories, while admins can manage all of them.</p>
          </div>
          <div className="admin-page-header-meta">
            <span>{categories.length} categories</span>
            <span>{categories.filter((category) => category.doc_count > 0).length} linked</span>
          </div>
        </header>

        {error ? <p className="admin-page-feedback is-error">{error}</p> : null}
        {message ? <p className="admin-page-feedback is-success">{message}</p> : null}

        <section className="admin-management-layout admin-categories-layout">
          <section className="admin-management-main admin-categories-main">
            <div className="admin-management-head">
              <div>
                <span className="admin-dashboard-label">Category Library</span>
                <h2>{loading ? 'Loading categories' : `${categories.length} available categories`}</h2>
              </div>
            </div>

            {categories.length === 0 && !loading ? (
              <div className="admin-dashboard-empty">
                <h3>No categories yet</h3>
                <p>Create the first category so documents can select it from the editor dropdown.</p>
              </div>
            ) : (
              <div className="admin-table admin-category-table">
                <div className="admin-table-head">
                  <span>Name</span>
                  <span>Owner</span>
                  <span>Linked Docs</span>
                  <span>Actions</span>
                </div>
                {categories.map((category) => (
                  <div key={category.id} className="admin-table-row">
                    <div>
                      <strong>{category.name}</strong>
                      <span>
                        {category.updated_at && category.updated_at !== category.created_at
                          ? `Updated ${new Date(category.updated_at).toLocaleDateString()}`
                          : 'Ready for editor selection'}
                      </span>
                    </div>
                    <span>{category.created_by_name || 'Unknown'}</span>
                    <span>{category.doc_count}</span>
                    <div className="admin-table-actions">
                      {category.can_manage ? (
                        <>
                          <button type="button" onClick={() => handleEdit(category)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(category)}
                            disabled={category.doc_count > 0}
                            title={
                              category.doc_count > 0
                                ? 'Replace linked document categories first'
                                : undefined
                            }
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <span className="admin-category-note">View only</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="admin-management-sidebar admin-categories-sidebar">
            <section className="admin-sidebar-section">
              <span className="admin-dashboard-label">{editingCategory ? 'Edit Category' : 'New Category'}</span>
              <h3>{editingCategory ? 'Update category' : 'Create category'}</h3>
              <p className="admin-category-sidebar-copy">
                Use one shared category name so similar documents do not split into mismatched labels like Technology and Technologies.
              </p>

              <form onSubmit={handleSave} className="admin-form-stack">
                <label className="admin-editor-field">
                  <span>Name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Authentication"
                    required
                  />
                </label>

                <div className="admin-form-actions">
                  <button type="submit" className="admin-editor-publish" disabled={saving || name.trim() === ''}>
                    {saving ? 'Saving...' : editingCategory ? 'Save Category' : 'Create Category'}
                  </button>
                  {editingCategory ? (
                    <button type="button" className="admin-avatar-secondary-button" onClick={resetForm}>
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
