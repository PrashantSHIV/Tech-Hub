import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Header from '@/components/Header';

type DocRecord = {
  id: string;
  title: string;
  description?: string;
  tags?: string;
  category?: string;
  author?: string;
  created_at?: string;
  updated_at?: string;
};

type AuditLog = {
  id: string;
  action: string;
  details: string;
  created_at: string;
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

const getLatestDocDate = (docs: DocRecord[]) => {
  const timestamps = docs
    .map((doc) => new Date(doc.updated_at || doc.created_at || '').getTime())
    .filter((value) => !Number.isNaN(value));

  if (timestamps.length === 0) return undefined;
  return new Date(Math.max(...timestamps)).toISOString();
};

export default function Dashboard() {
  const [docs, setDocs] = useState<DocRecord[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      void router.push('/login');
      return;
    }

    void fetchData();
  }, [router]);

  const fetchData = async () => {
    try {
      const resDocs = await fetch('http://localhost:8080/api/docs');
      if (!resDocs.ok) throw new Error('Failed to fetch docs');

      const docsData = await resDocs.json();
      const docsArray = Array.isArray(docsData) ? docsData : (docsData.docs || []);
      setDocs(docsArray);

      setLogs([
        { id: '1', action: 'LOGIN', details: 'Logged in', created_at: '2026-04-22 10:00' },
        { id: '2', action: 'CREATE_DOC', details: 'Created OAuth Guide', created_at: '2026-04-22 10:30' },
      ]);
    } catch (err) {
      console.error(err);
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:8080/api/admin/docs/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      alert('Failed to delete');
    }
  };

  const latestDocDate = getLatestDocDate(docs);
  const uniqueTopics = new Set(docs.flatMap((doc) => getDocTopics(doc))).size;

  return (
    <div
      className="admin-dashboard-page"
      style={{
        minHeight: '100vh',
        background: '#fff',
        color: '#1a1a1a',
        '--sp-border': '#f0f0f0',
        '--sp-accent': '#191919',
        '--sp-text': '#1a1a1a',
        '--sp-sans': 'Inter, sans-serif',
      } as React.CSSProperties}
    >
      <Head>
        <title>Writer Dashboard | Tech Hobby</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </Head>

      <Header />

      <main className="admin-dashboard-shell">
        <header className="admin-dashboard-header">
          <div className="admin-dashboard-intro">
            <span className="admin-dashboard-kicker">Editorial Workspace</span>
            <h1>Writer Dashboard</h1>
            <p>
              Review published guides, update technical references, and keep the documentation
              catalog current.
            </p>
          </div>

          <dl className="admin-dashboard-summary">
            <div className="admin-dashboard-summary-item">
              <dt>Published</dt>
              <dd>{docs.length} {docs.length === 1 ? 'guide' : 'guides'}</dd>
            </div>
            <div className="admin-dashboard-summary-item">
              <dt>Topics</dt>
              <dd>{uniqueTopics} tracked labels</dd>
            </div>
            <div className="admin-dashboard-summary-item">
              <dt>Latest Update</dt>
              <dd>{latestDocDate ? formatDate(latestDocDate) : 'No updates yet'}</dd>
            </div>
          </dl>
        </header>

        <section className="admin-dashboard-layout">
          <section className="admin-dashboard-main">
            <div className="admin-dashboard-section-head">
              <div>
                <span className="admin-dashboard-label">Your Documentation</span>
                <h2>{docs.length} published {docs.length === 1 ? 'guide' : 'guides'}</h2>
              </div>
              <span className="admin-dashboard-meta">Curated for Tech Hobby readers</span>
            </div>

            {loading ? (
              <div className="admin-dashboard-empty">Loading dashboard...</div>
            ) : docs.length === 0 ? (
              <div className="admin-dashboard-empty">
                <h3>No documentation yet</h3>
                <p>Start a new guide to populate your editorial dashboard.</p>
                <Link href="/admin/editor" className="admin-dashboard-primary-link">
                  Create your first doc
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
                          <span>{doc.author || 'Admin'}</span>
                          <span>{formatDate(doc.updated_at || doc.created_at)}</span>
                        </div>
                        <h3>{doc.title}</h3>
                        <p>
                          {doc.description || 'Technical documentation entry ready for refinement and maintenance.'}
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
              <h3>Publishing Control</h3>
              <p>
                Draft new technical guides, revise older documentation, and keep the catalog
                consistent.
              </p>
              <div className="admin-sidebar-actions">
                <Link href="/admin/editor" className="admin-sidebar-link is-primary">
                  Create New Doc
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('token');
                    void router.push('/login');
                  }}
                  className="admin-sidebar-link"
                >
                  Logout
                </button>
              </div>
            </section>

            <section className="admin-sidebar-section">
              <span className="admin-dashboard-label">Overview</span>
              <dl className="admin-sidebar-metrics">
                <div>
                  <dt>Published</dt>
                  <dd>{docs.length}</dd>
                </div>
                <div>
                  <dt>Recent Actions</dt>
                  <dd>{logs.length}</dd>
                </div>
              </dl>
            </section>

            <section className="admin-sidebar-section">
              <span className="admin-dashboard-label">Audit Log</span>
              <h3>Recent Actions</h3>
              <div className="admin-log-list">
                {logs.map((log) => (
                  <div key={log.id} className="admin-log-item">
                    <div className="admin-log-topline">
                      <span>{log.action.replace('_', ' ')}</span>
                      <time>{formatDate(log.created_at)}</time>
                    </div>
                    <p>{log.details}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="admin-sidebar-section">
              <span className="admin-dashboard-label">Editorial Focus</span>
              <p>
                Keep titles sharp, categories consistent, and update older guides before creating
                overlapping content.
              </p>
            </section>
          </aside>
        </section>
      </main>
    </div>
  );
}
