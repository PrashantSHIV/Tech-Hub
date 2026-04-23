import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import Head from 'next/head';
import Header from '@/components/Header';

export default function DocDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [doc, setDoc] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [stars, setStars] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [suggestionText, setSuggestionText] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeHeading, setActiveHeading] = useState("");
  const [feedbackTab, setFeedbackTab] = useState<'review' | 'suggestion'>('review');

  const headingsRef = useRef<any[]>([]);

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
      const docData = await resDoc.json();
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

  const slugify = (text: any) => {
    const extractText = (node: any): string => {
      if (!node) return "";
      if (typeof node === 'string') return node;
      if (Array.isArray(node)) return node.map(extractText).join('');
      if (node.props && node.props.children) return extractText(node.props.children);
      return String(node);
    };
    
    const plainText = extractText(text);
    return plainText
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const extractHeadings = (markdown: string) => {
    const lines = markdown.split('\n');
    const extracted: { id: string, text: string, level: number }[] = [];
    lines.forEach(line => {
      const match = line.match(/^(#{1,3})\s+(.*)/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        const id = slugify(text);
        extracted.push({ id, text, level });
      }
    });
    return extracted;
  };

  const headings = doc ? extractHeadings(doc.content) : [];

  useEffect(() => {
    if (!doc) return;

    let observer: IntersectionObserver;
    
    const timer = setTimeout(() => {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveHeading(entry.target.id);
            }
          });
        },
        { 
          rootMargin: '0px 0px -80% 0px',
          threshold: 0
        }
      );

      const headingElements = document.querySelectorAll('h1[id], h2[id], h3[id]');
      headingElements.forEach((el) => observer.observe(el));
    }, 1000);

    return () => {
      clearTimeout(timer);
      if (observer) observer.disconnect();
    };
  }, [doc?.id]);

  const scrollToHeading = (headingId: string) => {
    const element = document.getElementById(headingId);
    if (element) {
      const headerOffset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
      setActiveHeading(headingId);
    }
  };

  const CodeBlock = ({ children }: { children: any }) => {
    const [copied, setCopied] = useState(false);
    const codeRef = useRef<HTMLPreElement>(null);

    const handleCopy = () => {
      const text = codeRef.current?.innerText || "";
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div style={{ position: 'relative' }} className="code-block-container group">
        <button 
          onClick={handleCopy}
          className="copy-button"
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: copied ? '#22c55e' : 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '11px',
            fontWeight: '700',
            padding: '4px 10px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            zIndex: 10,
            fontFamily: 'Inter, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            opacity: copied ? 1 : 0,
            visibility: copied ? 'visible' : 'hidden'
          }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <style jsx>{`
          .code-block-container:hover .copy-button {
            opacity: 1 !important;
            visibility: visible !important;
          }
        `}</style>
        <pre 
          ref={codeRef}
          style={{
            background: '#0d1117',
            color: '#e6edf3',
            padding: '24px',
            borderRadius: '16px',
            overflowX: 'auto',
            margin: '2em 0',
            border: '1px solid #30363d',
            boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
            fontSize: '14px',
            lineHeight: '1.6',
            fontFamily: 'SFMono-Regular, Consolas, monospace'
          }}
        >
          {children}
        </pre>
      </div>
    );
  };

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
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
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
                    src="https://cdn.dribbble.com/userupload/15513631/file/original-5bcae1f588c45e3ce423136072afe2a8.jpg?format=webp&resize=400x300&vertical=center" 
                    alt="avatar" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', display: 'block', fontWeight: '700', letterSpacing: '0.5px', marginBottom: '2px' }}>Author</span>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#1a1a1a' }}>{doc.author || 'Admin'}</span>
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
                  <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: '600' }}>{new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
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
                    <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: '600' }}>{new Date(doc.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
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
                    {[
                      doc.category,
                      ...(doc.tags ? doc.tags.split(',').map((t: string) => t.trim()) : [])
                    ].filter(Boolean).length > 0 ? (
                      [
                        doc.category,
                        ...(doc.tags ? doc.tags.split(',').map((t: string) => t.trim()) : [])
                      ].filter(Boolean).map((tag, idx) => (
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
                fontSize: '30px', 
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
              <ReactMarkdown components={{
                h1: ({node, ...props}) => {
                  const id = slugify(props.children);
                  return <h1 id={id} style={{fontSize: '24px', fontWeight: '800', marginTop: '1.5em', marginBottom: '0.8em', color: '#1a1a1a', letterSpacing: '-1px', lineHeight: '1.2', fontFamily: "'Plus Jakarta Sans', sans-serif"}} {...props} />;
                },
                h2: ({node, ...props}) => {
                  const id = slugify(props.children);
                   return <h2 id={id} style={{fontSize: '20px', fontWeight: '800', marginTop: '2em', marginBottom: '0.6em', color: '#1a1a1a', letterSpacing: '-0.5px', lineHeight: '1.2', fontFamily: "'Plus Jakarta Sans', sans-serif"}} {...props} />;
                },
                h3: ({node, ...props}) => {
                  const id = slugify(props.children);
                  return <h3 id={id} style={{fontSize: '20px', fontWeight: '700', marginTop: '1.5em', marginBottom: '0.5em', color: '#1a1a1a', letterSpacing: '-0.3px', fontFamily: "'Plus Jakarta Sans', sans-serif"}} {...props} />;
                },
                p: ({node, ...props}) => <p style={{marginBottom: '1.4em', color: '#374151', fontSize: '16px'}} {...props} />,
                code: ({node, className, children, ...props}: any) => {
                  const match = /language-(\w+)/.exec(className || '');
                  const isInline = !match;
                  if (isInline) {
                    return <code style={{background: '#f6f8fa', padding: '0.2em 0.4em', borderRadius: '6px', fontSize: '14px', color: '#cf222e', fontFamily: 'SFMono-Regular, Consolas, monospace'}} {...props}>{children}</code>;
                  }
                  return <code className={className} {...props}>{children}</code>;
                },
                pre: ({node, ...props}) => <CodeBlock>{props.children}</CodeBlock>,
                blockquote: ({node, ...props}) => (
                  <blockquote style={{
                    margin: '2em 0',
                    padding: '1.2em 1.8em',
                    color: '#636e7b',
                    borderLeft: '4px solid #d0d7de',
                    background: '#fcfcfc',
                    borderRadius: '0 12px 12px 0',
                    fontStyle: 'italic',
                    fontSize: '16px'
                  }} {...props} />
                ),
                ul: ({node, ...props}) => <ul style={{marginBottom: '1.5em', paddingLeft: '1.5em', listStyleType: 'disc'}} {...props} />,
                ol: ({node, ...props}) => <ol style={{marginBottom: '1.5em', paddingLeft: '1.5em', listStyleType: 'decimal'}} {...props} />,
                li: ({node, ...props}) => <li style={{marginBottom: '0.6em', color: '#374151', fontSize: '16px'}} {...props} />,
                table: ({node, ...props}) => <table style={{width: '100%', borderCollapse: 'collapse', margin: '2em 0', fontSize: '15px', border: '1px solid #eee'}} {...props} />,
                th: ({node, ...props}) => <th style={{padding: '10px 14px', background: '#f6f8fa', fontWeight: '700', border: '1px solid #eee', textAlign: 'left'}} {...props} />,
                td: ({node, ...props}) => <td style={{padding: '10px 14px', border: '1px solid #eee'}} {...props} />,
              }}>
                {doc.content}
              </ReactMarkdown>
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

          <footer style={{ marginTop: '80px', paddingTop: '60px', borderTop: '1px solid #f0f0f0', fontFamily: 'Inter, sans-serif' }}>
            <section className="feedback">
              <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                <h3 style={{ 
                  fontFamily: "'Plus Jakarta Sans', sans-serif", 
                  fontSize: '32px', 
                  fontWeight: '800', 
                  color: '#1a1a1a', 
                  letterSpacing: '-1px', 
                  marginBottom: '12px' 
                }}>
                  Share your expertise.
                </h3>
                <p style={{ fontSize: '16px', color: '#666', maxWidth: '600px', margin: '0 auto' }}>
                  Your feedback helps us refine these guides for the entire technical community.
                </p>
              </div>

              {msg && (
                <div style={{ 
                  maxWidth: '720px', 
                  margin: '0 auto 40px',
                  background: '#f8fafc', 
                  padding: '16px 24px', 
                  borderRadius: '12px', 
                  color: '#475569', 
                  fontSize: '14px', 
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
                gap: '64px', 
                alignItems: 'start',
                maxWidth: '1240px',
                margin: '0 auto 80px'
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
                        padding: '16px', 
                        background: feedbackTab === 'review' ? '#fff' : '#fcfcfc',
                        border: 'none',
                        borderRight: '1px solid #f0f0f0',
                        fontSize: '11px',
                        fontWeight: '800',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
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
                        padding: '16px', 
                        background: feedbackTab === 'suggestion' ? '#fff' : '#fcfcfc',
                        border: 'none',
                        fontSize: '11px',
                        fontWeight: '800',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
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
                  <div style={{ padding: '32px' }}>
                    {feedbackTab === 'review' ? (
                      <div>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '24px', justifyContent: 'center' }}>
                          {[1, 2, 3, 4, 5].map(s => (
                            <span 
                              key={s} 
                              onClick={() => setStars(s)} 
                              style={{ 
                                cursor: 'pointer', 
                                fontSize: '28px', 
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
                            padding: '20px', 
                            borderRadius: '8px', 
                            border: '1px solid #f0f0f0', 
                            fontSize: '14px', 
                            height: '160px', 
                            outline: 'none', 
                            resize: 'none', 
                            background: '#fcfcfc', 
                            marginBottom: '20px', 
                            fontFamily: 'Inter, sans-serif',
                            lineHeight: '1.6'
                          }}
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                        ></textarea>
                        <button 
                          onClick={() => handleSubmitFeedback('comment')} 
                          className="btn-black" 
                          style={{ width: '100%', padding: '16px', borderRadius: '8px', fontSize: '14px', fontWeight: '700' }}
                        >
                          Submit Review
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px', textAlign: 'center' }}>
                          Notice a typo or have a technical correction? Send it to our editorial team.
                        </p>
                        <textarea 
                          placeholder="Suggest a correction..."
                          style={{ 
                            width: '100%', 
                            padding: '20px', 
                            borderRadius: '8px', 
                            border: '1px solid #f0f0f0', 
                            fontSize: '14px', 
                            height: '160px', 
                            outline: 'none', 
                            resize: 'none', 
                            background: '#fcfcfc', 
                            marginBottom: '20px', 
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
                            padding: '16px', 
                            borderRadius: '8px', 
                            fontSize: '14px', 
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px', flexShrink: 0 }}>
                    <h4 style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', color: '#1a1a1a' }}>Reader Comments</h4>
                    <div style={{ flex: 1, height: '1px', background: '#f0f0f0' }}></div>
                  </div>

                  {comments.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', background: '#fcfcfc', borderRadius: '8px', border: '1px dashed #f0f0f0' }}>
                      <p style={{ color: '#999', fontSize: '14px', fontStyle: 'italic' }}>No comments yet.</p>
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
