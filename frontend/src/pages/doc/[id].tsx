import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import Header from '@/components/Header';
import { API_BASE_URL } from '@/lib/api';
import DocumentContent from '@/components/DocumentContent';
import { normalizeContentBlocks } from '@/lib/content-blocks';

type PublicDocument = {
  id: string;
  title: string;
  description: string;
  content?: string;
  content_json?: unknown;
  author?: string;
  author_avatar?: string;
  category?: string;
  tags?: string;
  readTime?: string;
  created_at?: string;
  updated_at?: string;
};

export default function DocDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [doc, setDoc] = useState<PublicDocument | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commenterName, setCommenterName] = useState("");
  const [stars, setStars] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [suggestionText, setSuggestionText] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [feedbackTab, setFeedbackTab] = useState<'review' | 'suggestion'>('review');

  useEffect(() => {
    if (id) {
      fetchDocData();
    }
  }, [id]);

  const fetchDocData = async () => {
    setLoading(true);
    try {
      const resDoc = await fetch(`http://localhost:8080/api/docs/${id}`);
      if (!resDoc.ok) throw new Error("Doc not found");
      const docData = (await resDoc.json()) as PublicDocument;
      setDoc(docData);

      const resComments = await fetch(`http://localhost:8080/api/docs/${id}/comments`);
      if (resComments.ok) {
        const commentsData = await resComments.json();
        setComments(commentsData || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitFeedback = async (type: 'comment' | 'suggestion') => {
    const payload = {
      doc_id: id,
      commenter_name: commenterName,
      stars: type === 'comment' ? stars : 0,
      comment: type === 'comment' ? commentText : suggestionText,
      type: type
    };

    try {
      const res = await fetch('http://localhost:8080/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setMsg(type === 'comment' ? "Comment submitted for approval!" : "Suggestion sent to the team!");
        setCommenterName("");
        if (type === 'comment') { setCommentText(""); setStars(0); }
        else { setSuggestionText(""); }
      } else {
        const data = await res.json();
        setMsg(data.error || "Submission failed");
      }
    } catch (err) {
      setMsg("Connection error");
    }
  };

  const contentBlocks = useMemo(
    () => (doc ? normalizeContentBlocks(doc.content_json, doc.content || '') : []),
    [doc],
  );
  const authorAvatarSrc = doc?.author_avatar
    ? `${API_BASE_URL}${doc.author_avatar}`
    : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(doc?.author || 'Author') + '&background=f3f4f6&color=111827';
  const authorDisplayName = toTitleCase(doc?.author || 'Author');
  const categoryItems = (doc?.category || '')
    .split(',')
    .map((item: string) => item.trim())
    .filter(Boolean);
  const tagItems = (doc?.tags || '')
    .split(',')
    .map((item: string) => item.trim())
    .filter(Boolean);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Inter, sans-serif' }}>
      Loading documentation...
    </div>
  );

  if (!doc) return (
    <div style={{ padding: '100px 20px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
      <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '16px', color: '#1a1a1a' }}>Document not found</h1>
      <Link href="/search" style={{ color: '#1a1a1a', fontWeight: '600', textDecoration: 'underline' }}>Return to search</Link>
    </div>
  );

  return (
    <div className="doc-detail-page" style={{ 
      minHeight: '100vh', 
      background: '#fff', 
      color: '#1a1a1a', 
      fontFamily: 'Inter, sans-serif',
      /* Restore theme variables for header/buttons */
      '--sp-border': '#f0f0f0',
      '--sp-accent': '#191919',
      '--sp-text': '#1a1a1a',
      '--sp-sans': 'Inter, sans-serif'
    } as any}>
      <Head>
        <title>{doc.title} | Tech Hobby</title>
      </Head>

      <Header />

      <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'grid', gridTemplateColumns: '280px 1fr', gap: '60px' }}>
        {/* Sidebar Info Dashboard */}
        <aside className="doc-sidebar">
          {/* Basic Info Section */}
          <div style={{ fontFamily: 'Inter, sans-serif' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              {/* Author with Avatar */}
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ 
                  width: '40px', 
                  height: '40px', 
                  borderRadius: '50%', 
                  background: '#f0f0f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #eee',
                  overflow: 'hidden'
                }}>
                  <img
                    src={authorAvatarSrc}
                    alt={doc.author || 'Author avatar'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', display: 'block', fontWeight: '700', letterSpacing: '0.5px', marginBottom: '2px' }}>Author</span>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#1a1a1a' }}>{authorDisplayName}</span>
                </div>
              </div>
              
              {/* Minimalist Timeline Dates */}
              <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingLeft: '28px' }}>
                {/* Timeline Line */}
                <div style={{ 
                  position: 'absolute', 
                  left: '6px', 
                  top: '6px', 
                  bottom: '6px', 
                  width: '1px', 
                  background: '#eee' 
                }}></div>

                {/* Published Date */}
                <div style={{ position: 'relative', marginBottom: '20px' }}>
                  <div style={{ 
                    position: 'absolute', 
                    left: '-25px', 
                    top: '4px', 
                    width: '7px', 
                    height: '7px', 
                    borderRadius: '50%', 
                    background: '#bbb',
                    border: '2px solid #fff',
                    zIndex: 2
                  }}></div>
                  <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', display: 'block', fontWeight: '700', letterSpacing: '0.5px', marginBottom: '2px' }}>Published</span>
                  <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: '600' }}>
                    {formatDisplayDate(doc.created_at)}
                  </span>
                </div>

                {/* Updated Date (Optional) */}
                {doc.updated_at && doc.updated_at !== doc.created_at && (
                  <div style={{ position: 'relative' }}>
                    <div style={{ 
                      position: 'absolute', 
                      left: '-25px', 
                      top: '4px', 
                      width: '7px', 
                      height: '7px', 
                      borderRadius: '50%', 
                      background: '#bbb',
                      border: '2px solid #fff',
                      zIndex: 2
                    }}></div>
                    <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', display: 'block', fontWeight: '700', letterSpacing: '0.5px', marginBottom: '2px' }}>Latest Update</span>
                    <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: '600' }}>
                      {formatDisplayDate(doc.updated_at)}
                    </span>
                  </div>
                )}
              </div>

              {/* Category & Read Time Stats (Row Based) */}
              <div style={{ 
                marginTop: '32px', 
                paddingTop: '24px', 
                borderTop: '1px solid #f5f5f5',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.8px' }}>Categories</span>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {categoryItems.length > 0 ? (
                      categoryItems.map((tag, idx) => (
                        <span key={idx} style={{ 
                          background: '#f5f5f5', 
                          color: '#1a1a1a', 
                          padding: '4px 12px', 
                          borderRadius: '6px', 
                          fontSize: '11px', 
                          fontWeight: '600',
                          border: '1px solid #eee'
                        }}>
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: '11px', color: '#bbb', fontStyle: 'italic' }}>Uncategorized</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.8px' }}>Tags</span>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {tagItems.length > 0 ? (
                      tagItems.map((tag, idx) => (
                        <span key={idx} style={{ 
                          background: '#f5f5f5', 
                          color: '#1a1a1a', 
                          padding: '4px 12px', 
                          borderRadius: '6px', 
                          fontSize: '11px', 
                          fontWeight: '600',
                          border: '1px solid #eee'
                        }}>
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: '11px', color: '#bbb', fontStyle: 'italic' }}>No tags</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.8px' }}>Read Time</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1a1a1a' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    <span style={{ fontSize: '12px', fontWeight: '700' }}>{doc.readTime || '5 min read'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main style={{ padding: '60px 0 120px 0px', flex: 1, minWidth: 0 }}>
          <article style={{ maxWidth: '100%', margin: 0 }}>
            <div style={{ margin: 0, padding: 0, marginBottom: '40px' }}>
              <h1 style={{ 
                fontFamily: "'Plus Jakarta Sans', sans-serif", 
                fontSize: '35px',
                fontWeight: '800',
                lineHeight: '1.2', 
                color: '#1a1a1a',
                margin: 0,
                marginTop: 0,
                paddingTop: 0,
                letterSpacing: '-1px'
              }}>
                {doc.title}
              </h1>
              <div style={{ height: '1px', background: '#f0f0f0', marginTop: '24px' }}></div>
            </div>

            <div className="prose" style={{ 
              fontFamily: "'Plus Jakarta Sans', sans-serif", 
              fontSize: '16px', 
              lineHeight: '1.6', 
              color: '#374151',
            }}>
              <DocumentContent blocks={contentBlocks} />
            </div>

            {/* End of Documentation Section */}
            <div style={{ 
              marginTop: '60px', 
              marginBottom: '30px',
              textAlign: 'center',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              maxWidth: '900px'
            }}>
              <div style={{ 
                height: '1px', 
                background: '#f0f0f0', 
                position: 'absolute', 
                top: '50%', 
                left: '50%', 
                width: '240px',
                transform: 'translate(-50%, -50%)',
                zIndex: 1 
              }}></div>
              <span style={{ 
                position: 'relative', 
                zIndex: 2, 
                background: '#fff', 
                padding: '0 12px', 
                color: '#ccc', 
                fontSize: '9px', 
                fontWeight: '800', 
                textTransform: 'uppercase', 
                letterSpacing: '1px',
                fontFamily: 'Inter, sans-serif'
              }}>
                End of Documentation
              </span>
            </div>
          </article>

          <footer style={{ marginTop: '56px', paddingTop: '40px', borderTop: '1px solid #f0f0f0', fontFamily: 'Inter, sans-serif' }}>
            <section className="feedback">
              <div style={{ textAlign: 'center', marginBottom: '36px' }}>
                <h3 style={{ 
                  fontFamily: "'Plus Jakarta Sans', sans-serif", 
                  fontSize: '22px', 
                  fontWeight: '800', 
                  color: '#1a1a1a', 
                  letterSpacing: '-0.6px', 
                  marginBottom: '8px' 
                }}>
                  Share your expertise.
                </h3>
                <p style={{ fontSize: '14px', color: '#666', maxWidth: '560px', margin: '0 auto', lineHeight: '1.6' }}>
                  Your feedback helps us refine these guides for the entire technical community.
                </p>
              </div>

              {msg && (
                <div style={{ 
                  maxWidth: '720px', 
                  margin: '0 auto 28px',
                  background: '#f8fafc', 
                  padding: '12px 18px', 
                  borderRadius: '10px', 
                  color: '#475569', 
                  fontSize: '13px', 
                  border: '1px solid #e2e8f0', 
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                  {msg}
                </div>
              )}

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '40px', 
                alignItems: 'start',
                maxWidth: '1120px',
                margin: '0 auto 48px'
              }}>
                {/* Left: Feedback Input */}
                <div style={{ 
                  background: '#fff', 
                  borderRadius: '8px', 
                  border: '1px solid #f0f0f0', 
                  boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                  overflow: 'hidden',
                  position: 'sticky',
                  top: '100px'
                }}>
                  {/* Tabs */}
                  <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #f0f0f0' }}>
                    <button 
                      onClick={() => setFeedbackTab('review')}
                      style={{ 
                        flex: 1, 
                        padding: '13px', 
                        background: feedbackTab === 'review' ? '#fff' : '#fcfcfc',
                        border: 'none',
                        borderRight: '1px solid #f0f0f0',
                        fontSize: '10px',
                        fontWeight: '800',
                        textTransform: 'uppercase',
                        letterSpacing: '0.9px',
                        color: feedbackTab === 'review' ? '#1a1a1a' : '#888',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        fontFamily: 'Inter, sans-serif'
                      }}
                    >
                      Rate & Review
                    </button>
                    <button 
                      onClick={() => setFeedbackTab('suggestion')}
                      style={{ 
                        flex: 1, 
                        padding: '13px', 
                        background: feedbackTab === 'suggestion' ? '#fff' : '#fcfcfc',
                        border: 'none',
                        fontSize: '10px',
                        fontWeight: '800',
                        textTransform: 'uppercase',
                        letterSpacing: '0.9px',
                        color: feedbackTab === 'suggestion' ? '#1a1a1a' : '#888',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        fontFamily: 'Inter, sans-serif'
                      }}
                    >
                      Private Suggestions
                    </button>
                  </div>

                  {/* Form Area */}
                  <div style={{ padding: '22px' }}>
                    {feedbackTab === 'review' ? (
                      <div>
                        <input 
                          type="text"
                          placeholder="Your name"
                          style={{ 
                            width: '100%', 
                            padding: '12px 14px', 
                            borderRadius: '8px', 
                            border: '1px solid #f0f0f0', 
                            fontSize: '13px', 
                            outline: 'none', 
                            background: '#fcfcfc', 
                            marginBottom: '14px', 
                            fontFamily: 'Inter, sans-serif'
                          }}
                          value={commenterName}
                          onChange={(e) => setCommenterName(e.target.value)}
                        />
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '18px', justifyContent: 'center' }}>
                          {[1, 2, 3, 4, 5].map(s => (
                            <span 
                              key={s} 
                              onClick={() => setStars(s)} 
                              style={{ 
                                cursor: 'pointer', 
                                fontSize: '24px', 
                                color: s <= stars ? '#1a1a1a' : '#e0e0e0', 
                                transition: 'all 0.2s ease'
                              }}
                            >★</span>
                          ))}
                        </div>
                        <textarea 
                          placeholder="What did you think of this guide?"
                          style={{ 
                            width: '100%', 
                            padding: '16px', 
                            borderRadius: '8px', 
                            border: '1px solid #f0f0f0', 
                            fontSize: '13px', 
                            height: '124px', 
                            outline: 'none', 
                            resize: 'none', 
                            background: '#fcfcfc', 
                            marginBottom: '16px', 
                            fontFamily: 'Inter, sans-serif',
                            lineHeight: '1.6'
                          }}
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                        ></textarea>
                        <button 
                          onClick={() => handleSubmitFeedback('comment')} 
                          className="btn-black" 
                          style={{ width: '100%', padding: '13px', borderRadius: '8px', fontSize: '13px', fontWeight: '700' }}
                        >
                          Submit Review
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p style={{ fontSize: '12px', color: '#666', marginBottom: '16px', textAlign: 'center', lineHeight: '1.6' }}>
                          Notice a typo or have a technical correction? Send it to our editorial team.
                        </p>
                        <input 
                          type="text"
                          placeholder="Your name"
                          style={{ 
                            width: '100%', 
                            padding: '12px 14px', 
                            borderRadius: '8px', 
                            border: '1px solid #f0f0f0', 
                            fontSize: '13px', 
                            outline: 'none', 
                            background: '#fcfcfc', 
                            marginBottom: '14px', 
                            fontFamily: 'Inter, sans-serif'
                          }}
                          value={commenterName}
                          onChange={(e) => setCommenterName(e.target.value)}
                        />
                        <textarea 
                          placeholder="Suggest a correction..."
                          style={{ 
                            width: '100%', 
                            padding: '16px', 
                            borderRadius: '8px', 
                            border: '1px solid #f0f0f0', 
                            fontSize: '13px', 
                            height: '124px', 
                            outline: 'none', 
                            resize: 'none', 
                            background: '#fcfcfc', 
                            marginBottom: '16px', 
                            fontFamily: 'Inter, sans-serif',
                            lineHeight: '1.6'
                          }}
                          value={suggestionText}
                          onChange={(e) => setSuggestionText(e.target.value)}
                        ></textarea>
                        <button 
                          onClick={() => handleSubmitFeedback('suggestion')} 
                          className="btn-black" 
                          style={{ 
                            width: '100%', 
                            padding: '13px', 
                            borderRadius: '8px', 
                            fontSize: '13px', 
                            fontWeight: '700',
                            background: '#fff',
                            color: '#1a1a1a',
                            border: '1px solid #1a1a1a'
                          }}
                        >
                          Send to Team
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Approved Comments List */}
                <div style={{ maxHeight: '720px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexShrink: 0 }}>
                    <h4 style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', color: '#1a1a1a' }}>Reader Comments</h4>
                    <div style={{ flex: 1, height: '1px', background: '#f0f0f0' }}></div>
                  </div>

                  {comments.length === 0 ? (
                    <div style={{ padding: '28px', textAlign: 'center', background: '#fcfcfc', borderRadius: '8px', border: '1px dashed #f0f0f0' }}>
                      <p style={{ color: '#999', fontSize: '13px', fontStyle: 'italic' }}>No comments yet.</p>
                    </div>
                  ) : (
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '24px', 
                      overflowY: 'auto', 
                      paddingRight: '16px',
                      maxHeight: '640px'
                    }} className="custom-scrollbar">
                      {comments.map((c, i) => (
                        <div key={i} style={{ padding: '32px', background: '#fff', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              {[1, 2, 3, 4, 5].map(s => (
                                <span key={s} style={{ fontSize: '14px', color: s <= c.stars ? '#1a1a1a' : '#f0f0f0' }}>★</span>
                              ))}
                            </div>
                            <div style={{ fontSize: '12px', color: '#aaa', fontWeight: '600' }}>{new Date(c.created_at).toLocaleDateString()}</div>
                          </div>
                          <div style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: '700', marginBottom: '10px' }}>
                            {toTitleCase(c.commenter_name || 'Anonymous')}
                          </div>
                          <p style={{ fontSize: '15px', color: '#374151', lineHeight: '1.6', fontFamily: 'Inter, sans-serif' }}>{c.comment}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </footer>
        </main>
      </div>
    </div>
  );
}

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatDisplayDate(date?: string) {
  if (!date) {
    return '';
  }

  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
