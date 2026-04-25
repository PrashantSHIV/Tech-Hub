import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Header from '@/components/Header';
import AdminNav from '@/components/AdminNav';
import DocumentContent from '@/components/DocumentContent';
import { API_BASE_URL, apiRequest } from '@/lib/api';
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
  author_avatar?: string;
  created_at?: string;
  updated_at?: string;
};

type CategoryRecord = {
  id: string;
  name: string;
};

type FeedbackItem = {
  id: string;
  doc_id: string;
  commenter_name: string;
  stars: number;
  comment: string;
  type: 'comment' | 'suggestion';
  is_approved: boolean;
  created_at: string;
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
  const { id, mode } = router.query;
  const [user, setUser] = useState<AuthUser | null>(null);
  const [doc, setDoc] = useState<EditorDoc>(initialDoc);
  const [authorName, setAuthorName] = useState('');
  const [authorAvatar, setAuthorAvatar] = useState('');
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [blocks, setBlocks] = useState<ContentBlock[]>([createTextBlock()]);
  const [createdAt, setCreatedAt] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [error, setError] = useState('');
  const [previewTab, setPreviewTab] = useState<'document' | 'messages'>('document');

  const isExistingDoc = typeof id === 'string';
  const isPreviewMode = isExistingDoc && mode !== 'edit';

  useEffect(() => {
    const session = getAuthSession();
    if (!session) {
      void router.push('/login');
      return;
    }

    setUser(session.user);
    setAuthorName(session.user.username);
    void loadCategories(session.token);

    if (typeof id !== 'string') {
      setInitializing(false);
      setFeedbackItems([]);
      setFeedbackError('');
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
      setAuthorAvatar(data.author_avatar || '');
      setCreatedAt(data.created_at || '');
      setUpdatedAt(data.updated_at || '');
      setBlocks(normalizeContentBlocks(data.content_json, data.content || ''));
      await loadFeedback(token, documentID);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document');
    } finally {
      setInitializing(false);
    }
  };

  const loadCategories = async (token: string) => {
    try {
      const data = await apiRequest<CategoryRecord[]>('/api/admin/categories', { token });
      setCategories(data || []);
    } catch {
      setCategories([]);
    }
  };

  const loadFeedback = async (token: string, documentID: string) => {
    setFeedbackLoading(true);
    setFeedbackError('');

    try {
      const data = await apiRequest<FeedbackItem[]>(`/api/admin/docs/${documentID}/interactions`, {
        token,
      });
      setFeedbackItems(data || []);
    } catch (err) {
      setFeedbackItems([]);
      setFeedbackError(err instanceof Error ? err.message : 'Failed to load feedback');
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleApproveComment = async (interactionID: string) => {
    const session = getAuthSession();
    if (!session || typeof id !== 'string') {
      return;
    }

    setFeedbackError('');

    try {
      await apiRequest<{ message: string }>(`/api/admin/comments/${interactionID}/approve`, {
        method: 'POST',
        token: session.token,
      });
      await loadFeedback(session.token, id);
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Failed to approve comment');
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
      const path = typeof id === 'string' ? `/api/admin/docs/${id}` : '/api/admin/docs';

      const response = await apiRequest<ManagedDocumentResponse>(path, {
        method,
        token: session.token,
        json: payload,
      });

      if (typeof id === 'string') {
        void router.push(`/admin/editor?id=${id}`);
        return;
      }

      if (response?.id) {
        void router.push(`/admin/editor?id=${response.id}`);
        return;
      }

      void router.push('/admin/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save document');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const session = getAuthSession();
    if (!session || typeof id !== 'string') {
      return;
    }

    setDeleting(true);
    setError('');

    try {
      await apiRequest(`/api/admin/docs/${id}`, {
        method: 'DELETE',
        token: session.token,
      });
      void router.push('/admin/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
      setDeleting(false);
    }
  };

  const previewBlocks = useMemo(() => serializeContentBlocks(blocks), [blocks]);
  const categoryOptions = useMemo(() => {
    if (!doc.category) {
      return categories;
    }

    return categories.some((category) => category.name === doc.category)
      ? categories
      : [{ id: 'current-category', name: doc.category }, ...categories];
  }, [categories, doc.category]);
  const reviewItems = useMemo(
    () => feedbackItems.filter((item) => item.type === 'comment'),
    [feedbackItems],
  );
  const suggestionItems = useMemo(
    () => feedbackItems.filter((item) => item.type === 'suggestion'),
    [feedbackItems],
  );
  const categoryItems = useMemo(
    () =>
      doc.category
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    [doc.category],
  );
  const tagItems = useMemo(
    () =>
      doc.tags
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    [doc.tags],
  );
  const authorAvatarSrc = authorAvatar
    ? `${API_BASE_URL}${authorAvatar}`
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName || 'Author')}&background=f3f4f6&color=111827`;

  const renderPreviewContent = () => (
    <DocumentContent
      blocks={previewBlocks}
      className="admin-editor-preview-body"
      emptyState={<p>Start writing to preview the document here.</p>}
    />
  );

  const feedbackPanel = isExistingDoc ? (
    <section className="admin-editor-feedback-panel">
      <div className="admin-editor-section-head">
        <span className="admin-editor-kicker">Owner Feedback</span>
        <span className="admin-editor-section-note">
          Only the content owner can review this queue
        </span>
      </div>

      {feedbackError ? <p className="admin-editor-feedback is-error">{feedbackError}</p> : null}

      <div className="admin-editor-feedback-groups">
        <div className="admin-editor-feedback-group">
          <div className="admin-editor-feedback-head">
            <h3>Reviews</h3>
            <span>{reviewItems.length}</span>
          </div>

          {feedbackLoading ? (
            <p className="admin-editor-feedback-empty">Loading reviews...</p>
          ) : reviewItems.length === 0 ? (
            <p className="admin-editor-feedback-empty">No reviews yet.</p>
          ) : (
            <div className="admin-editor-feedback-list">
              {reviewItems.map((item) => (
                <article key={item.id} className="admin-editor-feedback-card">
                  <div className="admin-editor-feedback-card-top">
                    <div>
                      <strong className="admin-editor-feedback-name">{item.commenter_name}</strong>
                      <div className="admin-editor-feedback-stars">
                        {'★★★★★'.slice(0, item.stars)}
                        <span>{'★★★★★'.slice(item.stars)}</span>
                      </div>
                    </div>
                    <span className={`admin-editor-feedback-status${item.is_approved ? ' is-approved' : ''}`}>
                      {item.is_approved ? 'Approved' : 'Pending'}
                    </span>
                  </div>
                  <p>{item.comment}</p>
                  <div className="admin-editor-feedback-card-bottom">
                    <time>{new Date(item.created_at).toLocaleDateString()}</time>
                    {!item.is_approved ? (
                      <button
                        type="button"
                        className="admin-editor-feedback-action"
                        onClick={() => handleApproveComment(item.id)}
                      >
                        Approve
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="admin-editor-feedback-group">
          <div className="admin-editor-feedback-head">
            <h3>Private Suggestions</h3>
            <span>{suggestionItems.length}</span>
          </div>

          {feedbackLoading ? (
            <p className="admin-editor-feedback-empty">Loading suggestions...</p>
          ) : suggestionItems.length === 0 ? (
            <p className="admin-editor-feedback-empty">No private suggestions yet.</p>
          ) : (
            <div className="admin-editor-feedback-list">
              {suggestionItems.map((item) => (
                <article key={item.id} className="admin-editor-feedback-card">
                  <div className="admin-editor-feedback-card-top">
                    <div>
                      <strong className="admin-editor-feedback-name">{item.commenter_name}</strong>
                      <span className="admin-editor-feedback-status is-private">Private</span>
                    </div>
                    <time>{new Date(item.created_at).toLocaleDateString()}</time>
                  </div>
                  <p>{item.comment}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  ) : null;

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
              <h1>
                {isPreviewMode
                  ? doc.title || 'Document Preview'
                  : typeof id === 'string'
                    ? 'Edit Documentation'
                    : 'New Documentation'}
              </h1>
            </div>
          </div>

          <div className="admin-editor-topbar-actions">
            {isExistingDoc && isPreviewMode ? (
              <>
                <Link href={`/admin/editor?id=${id}&mode=edit`} className="admin-editor-secondary">
                  Edit
                </Link>
                <button type="button" className="admin-editor-danger" onClick={() => setDeleteModalOpen(true)}>
                  Delete
                </button>
              </>
            ) : (
              <>
                {isExistingDoc ? (
                  <Link href={`/admin/editor?id=${id}`} className="admin-editor-secondary">
                    Preview
                  </Link>
                ) : null}
                {isExistingDoc ? (
                  <button type="button" className="admin-editor-danger" onClick={() => setDeleteModalOpen(true)}>
                    Delete
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={loading || initializing}
                  className="admin-editor-publish"
                >
                  {loading ? 'Saving...' : doc.status === 'PUBLISHED' ? 'Save Published Doc' : 'Save Draft'}
                </button>
              </>
            )}
          </div>
        </header>

        {error ? <p className="admin-editor-feedback is-error">{error}</p> : null}

        {isPreviewMode ? (
          <section className="admin-editor-reader-layout">
            <aside className="admin-editor-reader-sidebar">
              <div className="admin-editor-reader-section">
                <span className="admin-editor-kicker">Author</span>
                <div className="admin-editor-reader-author">
                  <img src={authorAvatarSrc} alt={authorName || 'Author'} />
                  <strong>{authorName || 'Unknown author'}</strong>
                </div>
              </div>

              <div className="admin-editor-reader-section">
                <span className="admin-editor-kicker">Published</span>
                <strong>{formatDisplayDate(createdAt)}</strong>
              </div>

              <div className="admin-editor-reader-section">
                <span className="admin-editor-kicker">Updated</span>
                <strong>{formatDisplayDate(updatedAt)}</strong>
              </div>

              {categoryItems.length > 0 ? (
                <div className="admin-editor-reader-section">
                  <span className="admin-editor-kicker">Categories</span>
                  <div className="admin-editor-reader-tags">
                    {categoryItems.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                </div>
              ) : null}

              {tagItems.length > 0 ? (
                <div className="admin-editor-reader-section">
                  <span className="admin-editor-kicker">Tags</span>
                  <div className="admin-editor-reader-tags">
                    {tagItems.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                </div>
              ) : null}

              {doc.readTime ? (
                <div className="admin-editor-reader-section">
                  <span className="admin-editor-kicker">Read Time</span>
                  <strong>{doc.readTime}</strong>
                </div>
              ) : null}
            </aside>

            <section className="admin-editor-reader-main">
              <div className="admin-editor-preview-tabs" role="tablist" aria-label="Document owner views">
                <button
                  type="button"
                  className={previewTab === 'document' ? 'is-active' : ''}
                  onClick={() => setPreviewTab('document')}
                  role="tab"
                  aria-selected={previewTab === 'document'}
                >
                  Public Preview
                </button>
                <button
                  type="button"
                  className={previewTab === 'messages' ? 'is-active' : ''}
                  onClick={() => setPreviewTab('messages')}
                  role="tab"
                  aria-selected={previewTab === 'messages'}
                >
                  Messages
                </button>
              </div>

              {previewTab === 'document' ? (
                <article className="admin-editor-preview admin-editor-preview-full">
                  <h1>{doc.title || 'Untitled document'}</h1>
                  {doc.description ? (
                    <p className="admin-editor-preview-description">{doc.description}</p>
                  ) : null}

                  {renderPreviewContent()}
                </article>
              ) : (
                <div className="admin-editor-messages-view">
                  {feedbackPanel}
                </div>
              )}
            </section>
          </section>
        ) : (
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
                  <select
                    className="admin-editor-select"
                    value={doc.category}
                    onChange={(event) => setField('category', event.target.value)}
                    disabled={categories.length === 0}
                  >
                    <option value="">
                      {categories.length === 0 ? 'No categories available' : 'Select category'}
                    </option>
                    {categoryOptions.map((category) => (
                      <option key={category.id} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <span className="admin-editor-field-note">
                    {categories.length === 0 ? (
                      <>
                        No categories yet. <Link href="/admin/categories">Add the first category</Link>.
                      </>
                    ) : (
                      <>
                        Need another option? <Link href="/admin/categories">Manage categories</Link>.
                      </>
                    )}
                  </span>
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
                    <p className="admin-editor-loading">Loading document...</p>
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

                {doc.image ? (
                  <div className="admin-editor-feature-image">
                    <img src={doc.image} alt={doc.title || 'Document feature'} />
                  </div>
                ) : null}

                {renderPreviewContent()}
              </article>

              {feedbackPanel}
            </aside>
          </section>
        )}
      </main>

      {deleteModalOpen ? (
        <div
          className="admin-editor-modal-overlay"
          role="presentation"
          onClick={() => {
            setDeleteModalOpen(false);
            setDeleteConfirmText('');
          }}
        >
          <div
            className="admin-editor-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-doc-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="delete-doc-title">Delete document</h2>
            <p>
              This action cannot be undone. Type <strong>delete</strong> to confirm removal.
            </p>
            <input
              type="text"
              className="admin-editor-modal-input"
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              placeholder="Type delete"
            />
            <div className="admin-editor-modal-actions">
              <button
                type="button"
                className="admin-editor-secondary"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setDeleteConfirmText('');
                }}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-editor-danger"
                onClick={handleDelete}
                disabled={deleting || deleteConfirmText.trim().toLowerCase() !== 'delete'}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatDisplayDate(date: string) {
  if (!date) {
    return 'Not available';
  }

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
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
