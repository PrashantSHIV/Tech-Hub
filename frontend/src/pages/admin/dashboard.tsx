import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Header from '@/components/Header';
import AdminNav from '@/components/AdminNav';
import { API_BASE_URL, apiRequest } from '@/lib/api';
import { getAuthSession, type AuthUser } from '@/lib/auth';

type DocRecord = {
  id: string;
  title: string;
  description?: string;
  image?: string;
  tags?: string;
  category?: string;
  author?: string;
  author_avatar?: string;
  readTime?: string;
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

const resolveDocImage = (image?: string, id?: string) => {
  if (!image) return `https://source.unsplash.com/featured/?technology,coding&sig=${id}`;
  if (/^https?:\/\//i.test(image)) return image;
  return `/${image.replace(/^\/+/, '')}`;
};

const resolveAuthorAvatar = (authorAvatar?: string, authorName?: string) => {
  if (authorAvatar) {
    return `${API_BASE_URL}${authorAvatar}`;
  }

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName || 'Author')}&background=1a1a1a&color=fff`;
};

const toTitleCase = (value?: string) =>
  (value || 'Author')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

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
              <label className="admin-dashboard-search">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search"
                />
              </label>
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
                  return (
                    <article key={doc.id} className="admin-doc-card">
                      <Link href={`/admin/editor?id=${doc.id}`} className="admin-doc-card-main">
                        <div className="admin-doc-card-media">
                          <img
                            src={resolveDocImage(doc.image, doc.id)}
                            alt={doc.title}
                            className="admin-doc-card-image"
                          />
                        </div>
                        <div className="admin-doc-card-body">
                          <div className="admin-doc-card-meta">
                            <div className="admin-doc-card-meta-left">
                              <span className="admin-doc-card-category">
                                {doc.category || 'Article'}
                              </span>
                              <span
                                className={`admin-doc-status is-${(doc.status || 'DRAFT').toLowerCase()}`}
                              >
                                {doc.status || 'DRAFT'}
                              </span>
                            </div>
                            <span className="admin-doc-card-readtime">
                              {doc.readTime || '5 min read'}
                            </span>
                          </div>
                          <h3>{doc.title}</h3>
                          <p>
                            {doc.description ||
                              'Technical documentation entry ready for editing, review, and publication.'}
                          </p>
                          <div className="admin-doc-card-footer">
                            <div className="admin-doc-card-author">
                              <div className="admin-doc-card-avatar">
                                <img
                                  src={resolveAuthorAvatar(doc.author_avatar, doc.author)}
                                  alt={doc.author || 'Author'}
                                />
                              </div>
                              <span>{toTitleCase(doc.author)}</span>
                            </div>
                            <div className="admin-doc-card-dates">
                              {doc.created_at ? (
                                <span>Published: {formatDate(doc.created_at)}</span>
                              ) : null}
                              {doc.updated_at && doc.updated_at !== doc.created_at ? (
                                <span>Updated: {formatDate(doc.updated_at)}</span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </Link>

                      <div className="admin-doc-card-actions">
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
