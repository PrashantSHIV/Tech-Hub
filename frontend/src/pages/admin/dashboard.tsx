import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Header from '@/components/Header';
import AdminNav from '@/components/AdminNav';
import { apiRequest } from '@/lib/api';
import { getAuthSession, type AuthUser } from '@/lib/auth';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'my'>('all');

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

  const filteredDocs = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return docs.filter((doc) => {
      const isMyDoc =
        (doc.author || '').trim().toLowerCase() === (user?.username || '').trim().toLowerCase();
      if (scope === 'my' && !isMyDoc) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        doc.title,
        doc.description,
        doc.author,
        doc.category,
        doc.tags,
        doc.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [docs, scope, searchQuery, user?.username]);

  const filteredTopics = useMemo(() => {
    return new Set(filteredDocs.flatMap((doc) => getDocTopics(doc))).size;
  }, [filteredDocs]);

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
            <span className="admin-dashboard-kicker">Workspace</span>
            <h2>{user?.role === 'ADMIN' ? 'Admin Dashboard' : 'Writer Dashboard'}</h2>
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
                  {scope === 'my' ? 'My Documentation' : user?.role === 'ADMIN' ? 'All Documentation' : 'Your Documentation'}
                </span>
                <h2>{filteredDocs.length} tracked {filteredDocs.length === 1 ? 'entry' : 'entries'}</h2>
              </div>
              <div className="admin-dashboard-tools">
                {user?.role === 'ADMIN' ? (
                  <div className="admin-dashboard-tabs" role="tablist" aria-label="Document scope">
                    <button
                      type="button"
                      className={`admin-dashboard-tab${scope === 'all' ? ' is-active' : ''}`}
                      onClick={() => setScope('all')}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className={`admin-dashboard-tab${scope === 'my' ? ' is-active' : ''}`}
                      onClick={() => setScope('my')}
                    >
                      My
                    </button>
                  </div>
                ) : null}
                <label className="admin-dashboard-search">
                  <span className="admin-dashboard-search-label">Search</span>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search docs, authors, topics"
                  />
                </label>
                <span className="admin-dashboard-meta">
                  {filteredTopics} active {filteredTopics === 1 ? 'topic' : 'topics'}
                </span>
              </div>
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
            ) : filteredDocs.length === 0 ? (
              <div className="admin-dashboard-empty">
                <h3>No matching documentation</h3>
                <p>Adjust the search or switch tabs to see more entries.</p>
              </div>
            ) : (
              <div className="admin-doc-list">
                {filteredDocs.map((doc) => {
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
        </section>
      </main>
    </div>
  );
}
