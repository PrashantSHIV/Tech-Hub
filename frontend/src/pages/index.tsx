import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';

export default function Home() {
  return (
    <div className="medium-home">
      <Header />

      <section className="hero">
        <div className="hero-shell">
          <div className="hero-content">
            <h1>
              <span className="hero-stay">Stay</span>{" "}
              <span className="hero-curious">curious.</span>
            </h1>
            <p>Technical documentation, API guides, and deep dives into the tools that power the internet.</p>
            <Link href="/search" className="btn-cta">Start reading</Link>
          </div>
          <div className="hero-artwork" aria-hidden="true">
            <img src="/abstract.jpg" alt="" className="hero-visual" />
          </div>
        </div>
      </section>

      {/* Feed and sidebar removed to show only the hero section on the homepage */}
    </div>
  );
}
