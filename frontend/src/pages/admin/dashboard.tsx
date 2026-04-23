import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Dashboard() {
  const [docs, setDocs] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      // Fetch all docs from the API
      const resDocs = await fetch('http://localhost:8080/api/docs');
      if (!resDocs.ok) throw new Error('Failed to fetch docs');
      const docsData = await resDocs.json();
      
      // Handle both array and object response formats
      const docsArray = Array.isArray(docsData) ? docsData : (docsData.docs || []);
      setDocs(docsArray);
      
      // Mock logs for now
      setLogs([
        { id: "1", action: "LOGIN", details: "Logged in", created_at: "2026-04-22 10:00" },
        { id: "2", action: "CREATE_DOC", details: "Created OAuth Guide", created_at: "2026-04-22 10:30" }
      ]);
      
      setLoading(false);
    } catch (err) {
      console.error(err);
      setDocs([]);
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:8080/api/admin/docs/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchData();
    } catch (err) {
      alert("Failed to delete");
    }
  };

  if (loading) return <div>Loading dashboard...</div>;

  return (
    <div style={{ padding: '40px 10%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px' }}>Writer Dashboard</h1>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button onClick={() => { localStorage.removeItem('token'); router.push('/login'); }} className="btn-black" style={{ background: '#eee', color: '#333' }}>Logout</button>
          <Link href="/admin/editor" className="btn-black">Create New Doc</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '40px' }}>
        <section>
          <h3 style={{ marginBottom: '20px', textTransform: 'uppercase', fontSize: '14px', letterSpacing: '1px' }}>Your Documentation</h3>
          <div style={{ borderTop: '1px solid var(--border-light)' }}>
            {docs.map(doc => (
              <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 0', borderBottom: '1px solid var(--border-light)' }}>
                <div>
                  <h4 style={{ fontSize: '18px', fontWeight: 'bold' }}>{doc.title}</h4>
                  <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{doc.tags || doc.category || 'Article'}</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <Link href={`/admin/editor?id=${doc.id}`} style={{ color: 'blue', fontSize: '14px' }}>Edit</Link>
                  <button onClick={() => handleDelete(doc.id)} style={{ border: 'none', background: 'none', color: 'red', cursor: 'pointer', fontSize: '14px' }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside>
          <h3 style={{ marginBottom: '20px', textTransform: 'uppercase', fontSize: '14px', letterSpacing: '1px' }}>Recent Actions (Audit Log)</h3>
          <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px', fontSize: '13px' }}>
            {logs.map(log => (
              <div key={log.id} style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid #eee' }}>
                <div style={{ fontWeight: 'bold' }}>{log.action}</div>
                <div style={{ color: 'var(--text-muted)' }}>{log.details}</div>
                <div style={{ fontSize: '11px', marginTop: '5px', color: '#999' }}>{log.created_at}</div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
