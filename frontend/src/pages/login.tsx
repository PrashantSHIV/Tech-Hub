import React, { useState } from 'react';
import { useRouter } from 'next/router';

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch('http://localhost:8080/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        router.push('/admin/dashboard');
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err) {
      setError("Server connection failed");
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f9f9f9' }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', width: '100%', maxWidth: '400px' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', marginBottom: '30px', textAlign: 'center' }}>Writer Login</h1>
        
        {error && <div style={{ color: 'red', marginBottom: '20px', fontSize: '14px', textAlign: 'center' }}>{error}</div>}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>Email Address</label>
            <input 
              type="email" 
              className="search-input" 
              style={{ borderRadius: '4px', padding: '12px' }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>Password</label>
            <input 
              type="password" 
              className="search-input" 
              style={{ borderRadius: '4px', padding: '12px' }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-black" style={{ width: '100%', borderRadius: '4px', padding: '14px' }}>
            Sign In
          </button>
        </form>

        <div style={{ marginTop: '30px', textAlign: 'center' }}>
          <Link href="/" style={{ color: 'var(--text-muted)', fontSize: '14px', textDecoration: 'none' }}>← Back to home</Link>
        </div>
      </div>
    </div>
  );
}

import Link from 'next/link';
