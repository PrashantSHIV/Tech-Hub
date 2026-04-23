import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Header from '@/components/Header';
import AdminNav from '@/components/AdminNav';
import { apiRequest } from '@/lib/api';
import { clearAuthSession, getAuthSession, type AuthUser } from '@/lib/auth';

type DocRecord = {
  id: string;
  title: string;
  description?: string;
  tags?: string;
  category?: string;
  author?: string;
  created_at?: string;
  updated_at?: string;
  status?: 'DRAFT' | 'PUBLISHED';
};

type DocsResponse = {
  docs: DocRecord[];
  total: number;
};

const formatDate = (value?: string) => {
  if (!value) return 'Recently updated';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const getDocTopics = (doc: DocRecord) => {
  const tags = doc.tags
    ? doc.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
    : [];

  return Array.from(new Set([doc.category, ...tags].filter(Boolean))) as string[];
};

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [docs, setDocs] = useState<DocRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const session = getAuthSession();
    if (!session) {
      void router.push('/login');
      return;
    }

    setUser(session.user);
    void fetchDocuments(session.token, session.user);
  }, [router]);

  const fetchDocuments = async (token: string, authUser: AuthUser) => {
    setLoading(true);
    setError('');

    try {
      const query =
        authUser.role === 'ADMIN'
          ? '/api/admin/docs?scope=all&limit=50'
          : '/api/admin/docs?limit=50';
      const response = await apiRequest<DocsResponse>(query, { token });
      setDocs(response.docs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const session = getAuthSession();
    if (!session) {
      void router.push('/login');
      return;
    }

    if (!window.confirm('Delete this documentation entry?')) {
      return;
    }

    try {
      await apiRequest<{ message: string }>(`/api/admin/docs/${id}`, {
        method: 'DELETE',
        token: session.token,
      });

      await fetchDocuments(session.token, session.user);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  const handleLogout = () => {
    clearAuthSession();
    void router.push('/login');
  };

  const summary = useMemo(() => {
    const published = docs.filter((doc) => doc.status === 'PUBLISHED').length;
    const drafts = docs.filter((doc) => doc.status === 'DRAFT').length;
    const topics = new Set(docs.flatMap((doc) => getDocTopics(doc))).size;
    const latestTimestamp = docs
      .map((doc) => new Date(doc.updated_at || doc.created_at || '').getTime())
      .filter((value) => !Number.isNaN(value));

    return {
      published,
      drafts,
      topics,
      latest:
        latestTimestamp.length > 0
          ? formatDate(new Date(Math.max(...latestTimestamp)).toISOString())
          : 'No updates yet',
    };
  }, [docs]);

  return (
    <div className="admin-dashboard-page">
      <Head>
        <title>Writer Dashboard | Tech Hobby</title>
      </Head>

      <Header />

      <main className="admin-dashboard-shell">
        <AdminNav current="dashboard" role={user?.role} />

        <header className="admin-dashboard-header">
          <div className="admin-dashboard-intro">
            <span className="admin-dashboard-kicker">Editorial Workspace</span>
            <h1>{user?.role === 'ADMIN' ? 'Admin Dashboard' : 'Writer Dashboard'}</h1>
            <p>
              {user?.role === 'ADMIN'
                ? 'Manage your team, curated avatars, and every draft or published note in one editorial workspace.'
                : 'Create, refine, and publish your own documentation while keeping your profile and avatar selection current.'}
            </p>
          </div>

          <dl className="admin-dashboard-summary">
            <div className="admin-dashboard-summary-item">
              <dt>Role</dt>
              <dd>{user?.role ?? 'Loading'}</dd>
            </div>
            <div className="admin-dashboard-summary-item">
              <dt>Published</dt>
              <dd>{summary.published} live notes</dd>
            </div>
            <div className="admin-dashboard-summary-item">
              <dt>Drafts</dt>
              <dd>{summary.drafts} in progress</dd>
            </div>
            <div className="admin-dashboard-summary-item">
              <dt>Latest Update</dt>
              <dd>{summary.latest}</dd>
            </div>
          </dl>
        </header>

        <section className="admin-dashboard-layout">
          <section className="admin-dashboard-main">
            <div className="admin-dashboard-section-head">
              <div>
                <span className="admin-dashboard-label">
                  {user?.role === 'ADMIN' ? 'All Documentation' : 'Your Documentation'}
                </span>
                <h2>{docs.length} tracked {docs.length === 1 ? 'entry' : 'entries'}</h2>
              </div>
              <span className="admin-dashboard-meta">
                {summary.topics} active {summary.topics === 1 ? 'topic' : 'topics'}
              </span>
            </div>

            {loading ? (
              <div className="admin-dashboard-empty">Loading workspace...</div>
            ) : error ? (
              <div className="admin-dashboard-empty">
                <h3>Dashboard unavailable</h3>
                <p>{error}</p>
              </div>
            ) : docs.length === 0 ? (
              <div className="admin-dashboard-empty">
                <h3>No documentation yet</h3>
                <p>Start a new document to populate the editorial workspace.</p>
                <Link href="/admin/editor" className="admin-dashboard-primary-link">
                  Open editor
                </Link>
              </div>
            ) : (
              <div className="admin-doc-list">
                {docs.map((doc) => {
                  const topics = getDocTopics(doc);

                  return (
                    <article key={doc.id} className="admin-doc-card">
                      <div className="admin-doc-card-main">
                        <div className="admin-doc-card-meta">
                          <span>{doc.author || 'Unknown author'}</span>
                          <span>{formatDate(doc.updated_at || doc.created_at)}</span>
                          <span className={`admin-doc-status is-${(doc.status || 'DRAFT').toLowerCase()}`}>
                            {doc.status || 'DRAFT'}
                          </span>
                        </div>
                        <h3>{doc.title}</h3>
                        <p>
                          {doc.description ||
                            'Technical documentation entry ready for editing, review, and publication.'}
                        </p>
                        <div className="admin-doc-card-tags">
                          {topics.length > 0 ? (
                            topics.slice(0, 4).map((topic) => (
                              <span key={topic} className="admin-doc-chip">
                                {topic}
                              </span>
                            ))
                          ) : (
                            <span className="admin-doc-chip is-muted">Uncategorized</span>
                          )}
                        </div>
                      </div>

                      <div className="admin-doc-card-actions">
                        <Link href={`/admin/editor?id=${doc.id}`} className="admin-doc-action-link">
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(doc.id)}
                          className="admin-doc-action-link is-danger"
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="admin-dashboard-sidebar">
            <section className="admin-sidebar-section">
              <span className="admin-dashboard-label">Workspace</span>
              <h3>{user?.username || 'Editor'}</h3>
              <p>
                {user?.role === 'ADMIN'
                  ? 'Admins can create and override any document, manage users, and curate the avatar library.'
                  : 'Members can create and manage their own notes, then pick a curated avatar for their profile.'}
              </p>
              <div className="admin-sidebar-actions">
                <Link href="/admin/editor" className="admin-sidebar-link is-primary">
                  Create New Doc
                </Link>
                <Link href="/admin/profile" className="admin-sidebar-link">
                  Edit Profile
                </Link>
                {user?.role === 'ADMIN' ? (
                  <>
                    <Link href="/admin/users" className="admin-sidebar-link">
                      Manage Users
                    </Link>
                    <Link href="/admin/avatars" className="admin-sidebar-link">
                      Manage Avatar Library
                    </Link>
                  </>
                ) : null}
                <button type="button" onClick={handleLogout} className="admin-sidebar-link">
                  Logout
                </button>
              </div>
            </section>

            <section className="admin-sidebar-section">
              <span className="admin-dashboard-label">Overview</span>
              <dl className="admin-sidebar-metrics">
                <div>
                  <dt>Published</dt>
                  <dd>{summary.published}</dd>
                </div>
                <div>
                  <dt>Drafts</dt>
                  <dd>{summary.drafts}</dd>
                </div>
                <div>
                  <dt>Topics</dt>
                  <dd>{summary.topics}</dd>
                </div>
                <div>
                  <dt>Role</dt>
                  <dd>{user?.role === 'ADMIN' ? 'A' : 'M'}</dd>
                </div>
              </dl>
            </section>

            <section className="admin-sidebar-section">
              <span className="admin-dashboard-label">Publishing Rules</span>
              <p>
                Draft notes stay private to their author and admins. Published notes flow to the
                public documentation pages automatically.
              </p>
            </section>
          </aside>
        </section>
      </main>
    </div>
  );
}
