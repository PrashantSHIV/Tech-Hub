import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ReactMarkdown from 'react-markdown';
import Header from '@/components/Header';

type DocForm = {
  title: string;
  description: string;
  content: string;
  tags: string;
  author: string;
  category: string;
  image: string;
  readTime: string;
};

const initialDoc: DocForm = {
  title: '',
  description: '',
  content: '',
  tags: '',
  author: '',
  category: '',
  image: '',
  readTime: '',
};

export default function Editor() {
  const [doc, setDoc] = useState<DocForm>(initialDoc);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    if (id) {
      fetch(`http://localhost:8080/api/docs/${id}`)
        .then((res) => res.json())
        .then((data) => setDoc({ ...initialDoc, ...data }));
    }
  }, [id]);

  const handleSave = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const method = id ? 'PUT' : 'POST';
    const url = id ? `http://localhost:8080/api/admin/docs/${id}` : 'http://localhost:8080/api/admin/docs';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(doc),
      });

      if (res.ok) {
        void router.push('/admin/dashboard');
      } else {
        alert('Failed to save document');
      }
    } catch (err) {
      alert('Error saving document');
    } finally {
      setLoading(false);
    }
  };

  const setField = (field: keyof DocForm, value: string) => {
    setDoc((current) => ({ ...current, [field]: value }));
  };

  return (
    <div
      className="admin-editor-page"
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
        <title>{id ? 'Edit Documentation' : 'New Documentation'} | Tech Hobby</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </Head>

      <Header />

      <main className="admin-editor-shell">
        <header className="admin-editor-topbar">
          <div className="admin-editor-topbar-main">
            <Link href="/admin/dashboard" className="admin-editor-backlink">
              Back
            </Link>
            <div className="admin-editor-heading">
              <span className="admin-editor-kicker">Writing Workspace</span>
              <h1>{id ? 'Edit Documentation' : 'New Documentation'}</h1>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="admin-editor-publish"
          >
            {loading ? 'Saving...' : 'Publish Document'}
          </button>
        </header>

        <section className="admin-editor-layout">
          <section className="admin-editor-form-column">
            <div className="admin-editor-primary-fields">
              <label className="admin-editor-field admin-editor-field-title">
                <span>Title</span>
                <input
                  type="text"
                  placeholder="Document title"
                  value={doc.title}
                  onChange={(e) => setField('title', e.target.value)}
                />
              </label>

              <label className="admin-editor-field admin-editor-field-description">
                <span>Description</span>
                <textarea
                  placeholder="Short summary for readers"
                  value={doc.description}
                  onChange={(e) => setField('description', e.target.value)}
                  rows={3}
                />
              </label>
            </div>

            <div className="admin-editor-meta-grid">
              <label className="admin-editor-field">
                <span>Author</span>
                <input
                  type="text"
                  placeholder="Author name"
                  value={doc.author}
                  onChange={(e) => setField('author', e.target.value)}
                />
              </label>

              <label className="admin-editor-field">
                <span>Category</span>
                <input
                  type="text"
                  placeholder="Primary category"
                  value={doc.category}
                  onChange={(e) => setField('category', e.target.value)}
                />
              </label>

              <label className="admin-editor-field">
                <span>Image URL</span>
                <input
                  type="text"
                  placeholder="Image URL"
                  value={doc.image}
                  onChange={(e) => setField('image', e.target.value)}
                />
              </label>

              <label className="admin-editor-field">
                <span>Read Time</span>
                <input
                  type="text"
                  placeholder="10 min read"
                  value={doc.readTime}
                  onChange={(e) => setField('readTime', e.target.value)}
                />
              </label>

              <label className="admin-editor-field admin-editor-field-full">
                <span>Tags</span>
                <input
                  type="text"
                  placeholder="TypeScript, JavaScript, Web Development"
                  value={doc.tags}
                  onChange={(e) => setField('tags', e.target.value)}
                />
              </label>
            </div>

            <section className="admin-editor-content-panel">
              <div className="admin-editor-section-head">
                <span className="admin-editor-kicker">Content</span>
                <span className="admin-editor-section-note">Markdown supported</span>
              </div>
              <label className="admin-editor-field admin-editor-field-content">
                <textarea
                  placeholder="Write your technical documentation here..."
                  value={doc.content}
                  onChange={(e) => setField('content', e.target.value)}
                />
              </label>
            </section>
          </section>

          <aside className="admin-editor-preview-column">
            <div className="admin-editor-section-head">
              <span className="admin-editor-kicker">Preview</span>
              <span className="admin-editor-section-note">Live reading view</span>
            </div>

            <article className="admin-editor-preview">
              <h1>{doc.title || 'Untitled document'}</h1>
              {doc.description ? <p className="admin-editor-preview-description">{doc.description}</p> : null}

              <div className="admin-editor-preview-meta">
                {doc.author ? <span>{doc.author}</span> : null}
                {doc.category ? <span>{doc.category}</span> : null}
                {doc.readTime ? <span>{doc.readTime}</span> : null}
              </div>

              {doc.tags ? (
                <div className="admin-editor-preview-tags">
                  {doc.tags.split(',').map((tag) => tag.trim()).filter(Boolean).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              ) : null}

              <div className="admin-editor-preview-body">
                <ReactMarkdown>{doc.content || 'Start writing to preview the document here.'}</ReactMarkdown>
              </div>
            </article>
          </aside>
        </section>
      </main>
    </div>
  );
}