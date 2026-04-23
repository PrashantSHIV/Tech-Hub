import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ReactMarkdown from 'react-markdown';
import Header from '@/components/Header';
import AdminNav from '@/components/AdminNav';
import { apiRequest } from '@/lib/api';
import { getAuthSession, type AuthUser } from '@/lib/auth';
import {
  createImageRowBlock,
  createTextBlock,
  deriveLegacyContent,
  normalizeContentBlocks,
  serializeContentBlocks,
  syncImageRowLayout,
  type ContentBlock,
  type ImageRowBlock,
} from '@/lib/content-blocks';

type EditorDoc = {
  title: string;
  description: string;
  tags: string;
  category: string;
  image: string;
  readTime: string;
  status: 'DRAFT' | 'PUBLISHED';
};

type ManagedDocumentResponse = EditorDoc & {
  id: string;
  content?: string;
  content_json?: unknown;
  author?: string;
};

const initialDoc: EditorDoc = {
  title: '',
  description: '',
  tags: '',
  category: '',
  image: '',
  readTime: '',
  status: 'DRAFT',
};

export default function Editor() {
  const router = useRouter();
  const { id } = router.query;
  const [user, setUser] = useState<AuthUser | null>(null);
  const [doc, setDoc] = useState<EditorDoc>(initialDoc);
  const [authorName, setAuthorName] = useState('');
  const [blocks, setBlocks] = useState<ContentBlock[]>([createTextBlock()]);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const session = getAuthSession();
    if (!session) {
      void router.push('/login');
      return;
    }

    setUser(session.user);
    setAuthorName(session.user.username);

    if (typeof id !== 'string') {
      setInitializing(false);
      return;
    }

    void loadDocument(session.token, id);
  }, [id, router]);

  const loadDocument = async (token: string, documentID: string) => {
    setInitializing(true);
    setError('');

    try {
      const data = await apiRequest<ManagedDocumentResponse>(`/api/admin/docs/${documentID}`, {
        token,
      });

      setDoc({
        title: data.title || '',
        description: data.description || '',
        tags: data.tags || '',
        category: data.category || '',
        image: data.image || '',
        readTime: data.readTime || '',
        status: data.status || 'DRAFT',
      });
      setAuthorName(data.author || '');
      setBlocks(normalizeContentBlocks(data.content_json, data.content || ''));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document');
    } finally {
      setInitializing(false);
    }
  };

  const setField = (field: keyof EditorDoc, value: string) => {
    setDoc((current) => ({
      ...current,
      [field]: field === 'status' ? (value as EditorDoc['status']) : value,
    }));
  };

  const setTextBlock = (blockID: string, markdown: string) => {
    setBlocks((current) =>
      current.map((block) => (block.id === blockID && block.type === 'text' ? { ...block, markdown } : block)),
    );
  };

  const setImageRowLayout = (blockID: string, layout: 'single' | 'double') => {
    setBlocks((current) =>
      current.map((block) =>
        block.id === blockID && block.type === 'image_row' ? syncImageRowLayout(block, layout) : block,
      ),
    );
  };

  const setImageField = (
    blockID: string,
    imageIndex: number,
    field: 'url' | 'alt' | 'caption',
    value: string,
  ) => {
    setBlocks((current) =>
      current.map((block) => {
        if (block.id !== blockID || block.type !== 'image_row') {
          return block;
        }

        return {
          ...block,
          images: block.images.map((image, index) =>
            index === imageIndex ? { ...image, [field]: value } : image,
          ),
        };
      }),
    );
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    setBlocks((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const reordered = [...current];
      const [block] = reordered.splice(index, 1);
      reordered.splice(nextIndex, 0, block);
      return reordered;
    });
  };

  const removeBlock = (blockID: string) => {
    setBlocks((current) => {
      const next = current.filter((block) => block.id !== blockID);
      return next.length > 0 ? next : [createTextBlock()];
    });
  };

  const addTextBlock = () => {
    setBlocks((current) => [...current, createTextBlock()]);
  };

  const addImageRowBlock = () => {
    setBlocks((current) => [...current, createImageRowBlock('single')]);
  };

  const handleSave = async () => {
    const session = getAuthSession();
    if (!session) {
      void router.push('/login');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const contentJSON = serializeContentBlocks(blocks);
      const payload = {
        ...doc,
        content: deriveLegacyContent(blocks),
        content_json: contentJSON,
      };

      const method = typeof id === 'string' ? 'PUT' : 'POST';
      const path =
        typeof id === 'string' ? `/api/admin/docs/${id}` : '/api/admin/docs';

      await apiRequest(path, {
        method,
        token: session.token,
        json: payload,
      });

      void router.push('/admin/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save document');
    } finally {
      setLoading(false);
    }
  };

  const previewBlocks = useMemo(() => serializeContentBlocks(blocks), [blocks]);

  return (
    <div className="admin-editor-page">
      <Head>
        <title>{typeof id === 'string' ? 'Edit Documentation' : 'New Documentation'} | Tech Hobby</title>
      </Head>

      <Header />

      <main className="admin-editor-shell">
        <AdminNav current="editor" role={user?.role} />

        <header className="admin-editor-topbar">
          <div className="admin-editor-topbar-main">
            <div className="admin-editor-heading">
              <h1>{typeof id === 'string' ? 'Edit Documentation' : 'New Documentation'}</h1>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={loading || initializing}
            className="admin-editor-publish"
          >
            {loading ? 'Saving...' : doc.status === 'PUBLISHED' ? 'Save Published Doc' : 'Save Draft'}
          </button>
        </header>

        {error ? <p className="admin-editor-feedback is-error">{error}</p> : null}

        <section className="admin-editor-layout">
          <section className="admin-editor-form-column">
            <div className="admin-editor-primary-fields">
              <label className="admin-editor-field admin-editor-field-title">
                <span>Title</span>
                <input
                  type="text"
                  placeholder="Document title"
                  value={doc.title}
                  onChange={(event) => setField('title', event.target.value)}
                />
              </label>

              <label className="admin-editor-field admin-editor-field-description">
                <span>Description</span>
                <textarea
                  placeholder="Short summary for readers"
                  value={doc.description}
                  onChange={(event) => setField('description', event.target.value)}
                  rows={3}
                />
              </label>
            </div>

            <div className="admin-editor-meta-grid">
              <label className="admin-editor-field">
                <span>Author</span>
                <input type="text" value={authorName} readOnly />
              </label>

              <label className="admin-editor-field">
                <span>Status</span>
                <select
                  className="admin-editor-select"
                  value={doc.status}
                  onChange={(event) => setField('status', event.target.value)}
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="PUBLISHED">PUBLISHED</option>
                </select>
              </label>

              <label className="admin-editor-field">
                <span>Category</span>
                <input
                  type="text"
                  placeholder="Primary category"
                  value={doc.category}
                  onChange={(event) => setField('category', event.target.value)}
                />
              </label>

              <label className="admin-editor-field">
                <span>Read Time</span>
                <input
                  type="text"
                  placeholder="10 min read"
                  value={doc.readTime}
                  onChange={(event) => setField('readTime', event.target.value)}
                />
              </label>

              <label className="admin-editor-field admin-editor-field-full">
                <span>Feature Image URL</span>
                <input
                  type="text"
                  placeholder="https://example.com/image.jpg"
                  value={doc.image}
                  onChange={(event) => setField('image', event.target.value)}
                />
              </label>

              <label className="admin-editor-field admin-editor-field-full">
                <span>Tags</span>
                <input
                  type="text"
                  placeholder="TypeScript, JavaScript, Web Development"
                  value={doc.tags}
                  onChange={(event) => setField('tags', event.target.value)}
                />
              </label>
            </div>

            <section className="admin-editor-content-panel">
              <div className="admin-editor-section-head">
                <span className="admin-editor-kicker">Content Blocks</span>
                <span className="admin-editor-section-note">
                  Text blocks and image rows stored in JSON
                </span>
              </div>

              <div className="admin-editor-block-list">
                {initializing ? (
                  <p className="admin-editor-loading">Loading document…</p>
                ) : (
                  blocks.map((block, index) => (
                    <article key={block.id} className="admin-editor-block">
                      <div className="admin-editor-block-head">
                        <div>
                          <strong>
                            {block.type === 'text' ? 'Text Block' : 'Image Row'} {index + 1}
                          </strong>
                          <span>
                            {block.type === 'text'
                              ? 'Markdown content'
                              : `${block.layout === 'double' ? 'Two-image' : 'Single-image'} row`}
                          </span>
                        </div>
                        <div className="admin-editor-block-actions">
                          <button type="button" onClick={() => moveBlock(index, -1)}>
                            Up
                          </button>
                          <button type="button" onClick={() => moveBlock(index, 1)}>
                            Down
                          </button>
                          <button type="button" onClick={() => removeBlock(block.id)}>
                            Remove
                          </button>
                        </div>
                      </div>

                      {block.type === 'text' ? (
                        <label className="admin-editor-field admin-editor-field-content">
                          <textarea
                            placeholder="Write markdown for this block..."
                            value={block.markdown}
                            onChange={(event) => setTextBlock(block.id, event.target.value)}
                          />
                        </label>
                      ) : (
                        <ImageRowEditor
                          block={block}
                          onLayoutChange={setImageRowLayout}
                          onImageFieldChange={setImageField}
                        />
                      )}
                    </article>
                  ))
                )}
              </div>

              <div className="admin-editor-additions">
                <button type="button" onClick={addTextBlock} className="admin-editor-add-button">
                  Add Text Block
                </button>
                <button type="button" onClick={addImageRowBlock} className="admin-editor-add-button">
                  Add Image Row
                </button>
              </div>
            </section>
          </section>

          <aside className="admin-editor-preview-column">
            <div className="admin-editor-section-head">
              <span className="admin-editor-kicker">Preview</span>
              <span className="admin-editor-section-note">Public reading view</span>
            </div>

            <article className="admin-editor-preview">
              <h1>{doc.title || 'Untitled document'}</h1>
              {doc.description ? (
                <p className="admin-editor-preview-description">{doc.description}</p>
              ) : null}

              <div className="admin-editor-preview-meta">
                {authorName ? <span>{authorName}</span> : null}
                {doc.category ? <span>{doc.category}</span> : null}
                {doc.readTime ? <span>{doc.readTime}</span> : null}
                <span>{doc.status}</span>
              </div>

              {doc.tags ? (
                <div className="admin-editor-preview-tags">
                  {doc.tags
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean)
                    .map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                </div>
              ) : null}

              {doc.image ? (
                <div className="admin-editor-feature-image">
                  <img src={doc.image} alt={doc.title || 'Document feature'} />
                </div>
              ) : null}

              <div className="admin-editor-preview-body">
                {previewBlocks.length === 0 ? (
                  <p>Start writing to preview the document here.</p>
                ) : (
                  previewBlocks.map((block, index) => {
                    if (block.type === 'text') {
                      return <ReactMarkdown key={`${block.type}-${index}`}>{block.markdown}</ReactMarkdown>;
                    }

                    return (
                      <div
                        key={`${block.type}-${index}`}
                        className={`admin-editor-preview-image-row is-${block.layout}`}
                      >
                        {block.images.map((image, imageIndex) => (
                          <figure key={`${image.url}-${imageIndex}`}>
                            <img src={image.url} alt={image.alt || `Row image ${imageIndex + 1}`} />
                            {image.caption ? <figcaption>{image.caption}</figcaption> : null}
                          </figure>
                        ))}
                      </div>
                    );
                  })
                )}
              </div>
            </article>
          </aside>
        </section>
      </main>
    </div>
  );
}

type ImageRowEditorProps = {
  block: ImageRowBlock;
  onLayoutChange: (blockID: string, layout: 'single' | 'double') => void;
  onImageFieldChange: (
    blockID: string,
    imageIndex: number,
    field: 'url' | 'alt' | 'caption',
    value: string,
  ) => void;
};

function ImageRowEditor({ block, onLayoutChange, onImageFieldChange }: ImageRowEditorProps) {
  return (
    <div className="admin-editor-image-row-form">
      <label className="admin-editor-field">
        <span>Layout</span>
        <select
          className="admin-editor-select"
          value={block.layout}
          onChange={(event) => onLayoutChange(block.id, event.target.value as 'single' | 'double')}
        >
          <option value="single">Single</option>
          <option value="double">Double</option>
        </select>
      </label>

      <div className={`admin-editor-image-grid is-${block.layout}`}>
        {block.images.map((image, index) => (
          <div key={`${block.id}-${index}`} className="admin-editor-image-fields">
            <label className="admin-editor-field">
              <span>Image URL {index + 1}</span>
              <input
                type="text"
                placeholder="https://example.com/image.jpg"
                value={image.url}
                onChange={(event) => onImageFieldChange(block.id, index, 'url', event.target.value)}
              />
            </label>
            <label className="admin-editor-field">
              <span>Alt Text</span>
              <input
                type="text"
                placeholder="Short image description"
                value={image.alt || ''}
                onChange={(event) => onImageFieldChange(block.id, index, 'alt', event.target.value)}
              />
            </label>
            <label className="admin-editor-field">
              <span>Caption</span>
              <input
                type="text"
                placeholder="Optional caption"
                value={image.caption || ''}
                onChange={(event) => onImageFieldChange(block.id, index, 'caption', event.target.value)}
              />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
