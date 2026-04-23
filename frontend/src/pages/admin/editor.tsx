import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Editor() {
  const [doc, setDoc] = useState({ 
    title: "", 
    description: "", 
    content: "", 
    tags: "",
    author: "",
    category: "",
    image: "",
    readTime: ""
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    if (id) {
      // Fetch existing doc if editing
      fetch(`http://localhost:8080/api/docs/${id}`)
        .then(res => res.json())
        .then(data => setDoc(data));
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
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(doc)
      });

      if (res.ok) {
        router.push('/admin/dashboard');
      } else {
        alert("Failed to save document");
      }
    } catch (err) {
      alert("Error saving document");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link href="/admin/dashboard" style={{ textDecoration: 'none', color: '#666' }}>← Back</Link>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px' }}>{id ? "Edit" : "New"} Documentation</h1>
        </div>
        <button onClick={handleSave} disabled={loading} className="btn-black">
          {loading ? "Saving..." : "Publish Document"}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', height: 'calc(100vh - 120px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'auto' }}>
          <input 
            type="text" 
            placeholder="Document Title" 
            style={{ fontSize: '32px', fontWeight: 'bold', border: 'none', outline: 'none', borderBottom: '1px solid #eee', padding: '10px 0' }}
            value={doc.title}
            onChange={(e) => setDoc({...doc, title: e.target.value})}
          />
          <input 
            type="text" 
            placeholder="Short description..." 
            style={{ fontSize: '18px', border: 'none', outline: 'none', borderBottom: '1px solid #eee', padding: '10px 0', color: '#666' }}
            value={doc.description}
            onChange={(e) => setDoc({...doc, description: e.target.value})}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <input 
              type="text" 
              placeholder="Author Name" 
              style={{ fontSize: '14px', border: '1px solid #eee', outline: 'none', padding: '10px', borderRadius: '4px' }}
              value={doc.author}
              onChange={(e) => setDoc({...doc, author: e.target.value})}
            />
            <input 
              type="text" 
              placeholder="Category" 
              style={{ fontSize: '14px', border: '1px solid #eee', outline: 'none', padding: '10px', borderRadius: '4px' }}
              value={doc.category}
              onChange={(e) => setDoc({...doc, category: e.target.value})}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <input 
              type="text" 
              placeholder="Image URL" 
              style={{ fontSize: '14px', border: '1px solid #eee', outline: 'none', padding: '10px', borderRadius: '4px' }}
              value={doc.image}
              onChange={(e) => setDoc({...doc, image: e.target.value})}
            />
            <input 
              type="text" 
              placeholder="Read Time (e.g. 10 min read)" 
              style={{ fontSize: '14px', border: '1px solid #eee', outline: 'none', padding: '10px', borderRadius: '4px' }}
              value={doc.readTime}
              onChange={(e) => setDoc({...doc, readTime: e.target.value})}
            />
          </div>

          <input 
            type="text" 
            placeholder="Tags (comma separated)" 
            style={{ fontSize: '14px', border: 'none', outline: 'none', borderBottom: '1px solid #eee', padding: '10px 0' }}
            value={doc.tags}
            onChange={(e) => setDoc({...doc, tags: e.target.value})}
          />
          <textarea 
            placeholder="Write your technical documentation here (Markdown supported)..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: '16px', lineHeight: '1.6', fontFamily: 'var(--font-body)', resize: 'none' }}
            value={doc.content}
            onChange={(e) => setDoc({...doc, content: e.target.value})}
          ></textarea>
        </div>

        <div style={{ borderLeft: '1px solid #eee', paddingLeft: '20px', overflowY: 'auto' }}>
          <div style={{ color: '#aaa', fontSize: '12px', textTransform: 'uppercase', marginBottom: '10px' }}>Preview</div>
          <div style={{ fontFamily: 'var(--font-body)', lineHeight: '1.6' }}>
            <h1 style={{ fontSize: '40px', marginBottom: '20px' }}>{doc.title}</h1>
            <div style={{ whiteSpace: 'pre-wrap' }}>{doc.content}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
