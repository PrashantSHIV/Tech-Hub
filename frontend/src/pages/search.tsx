import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Header from '@/components/Header';
import { API_BASE_URL } from '@/lib/api';

const SkeletonLoader = () => (
  <div className="search-skeleton">
    <div className="search-skeleton-image skeleton-image"></div>
    <div className="search-skeleton-body">
      <div className="search-skeleton-chip skeleton-text"></div>
      <div className="search-skeleton-title skeleton-text"></div>
      <div className="search-skeleton-copy skeleton-text"></div>
      <div className="search-skeleton-meta">
        <div className="search-skeleton-author skeleton-text"></div>
        <div className="search-skeleton-date skeleton-text"></div>
      </div>
    </div>
  </div>
);

const resolveDocImage = (image?: string, id?: string) => {
  if (!image) return `https://source.unsplash.com/featured/?technology,coding&sig=${id}`;
  if (/^https?:\/\//i.test(image)) return image;
  return `/${image.replace(/^\/+/, '')}`;
};

const resolveAuthorAvatar = (authorAvatar?: string, authorName?: string) => {
  if (authorAvatar) {
    return `${API_BASE_URL}${authorAvatar}`;
  }

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName || 'Author')}&background=1a1a1a&color=fff`;
};

const toTitleCase = (value?: string) =>
  (value || 'Author')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

export default function SearchPage() {
  const router = useRouter();
  const categoryQuery = typeof router.query.category === 'string' ? router.query.category : 'All';
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);
  const [docs, setDocs] = useState<any[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<string[]>(['All']);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('http://localhost:8080/api/categories');
        if (response.ok) {
          const data = await response.json();
          setCategories(['All', ...(data || [])]);
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      }
    };

    fetchCategories();
  }, []);

  useEffect(() => {
    const normalizedCategory = categories.includes(categoryQuery) ? categoryQuery : 'All';
    setActiveCategory(normalizedCategory);
    setCurrentPage(1);
  }, [categoryQuery, categories]);

  useEffect(() => {
    const fetchDocs = async () => {
      setIsLoading(true);
      try {
        const category = activeCategory === 'All' ? '' : activeCategory;
        const response = await fetch(
          `http://localhost:8080/api/docs?page=${currentPage}&limit=6&category=${category}&q=${search}`
        );
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        const docsArray = Array.isArray(data) ? data : (data.docs || []);
        setDocs(docsArray);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || docsArray.length);
      } catch (error) {
        console.error('Failed to fetch docs:', error);
        setDocs([]);
        setTotalPages(0);
        setTotal(0);
      } finally {
        setIsLoading(false);
        setHasFetched(true);
      }
    };

    const timer = setTimeout(() => {
      fetchDocs();
    }, 300);

    return () => clearTimeout(timer);
  }, [currentPage, activeCategory, search]);

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
    void router.push(
      category === 'All' ? '/search' : `/search?category=${encodeURIComponent(category)}`,
      undefined,
      { shallow: true }
    );
  };

  const visibleTotalPages = Math.max(totalPages, 1);
  const visibleCurrentPage = Math.min(currentPage, visibleTotalPages);

  return (
    <div className="search-page">
      <Head>
        <title>Search Documentations | Tech Hobby</title>
      </Head>

      <Header
        centerContent={
          <div className="search-input-shell search-navbar-input-shell">
            <span className="search-input-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </span>
            <input
              id="search-input"
              className="search-page-input"
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by Topic , Description, Author, Tags"
            />
          </div>
        }
      />

      <main className="search-main">
        <aside className="search-sidebar-panel">
          <div className="search-sidebar-block">
            <div className="search-sidebar-row">
              <span className="search-sidebar-label">Categories</span>
              <span className="search-sidebar-count">{Math.max(categories.length - 1, 0)}</span>
            </div>
            <div className="search-categories search-categories-sidebar">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => handleCategoryChange(category)}
                  className={`search-chip${category === activeCategory ? ' active' : ''}`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* total results moved to top-right of results panel */}

          <div className="search-sidebar-block search-sidebar-pagination">
            <div className="search-sidebar-row">
              <span className="search-sidebar-label">Pagination</span>
              <span className="search-sidebar-count">{visibleCurrentPage}/{visibleTotalPages}</span>
            </div>
            <div className="search-sidebar-pagination-controls">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                disabled={visibleCurrentPage === 1}
                className="search-sidebar-pagination-btn"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(page + 1, visibleTotalPages))}
                disabled={visibleCurrentPage === visibleTotalPages}
                className="search-sidebar-pagination-btn"
              >
                Next
              </button>
            </div>
          </div>
        </aside>

        <section className="search-results-panel">
          <div className="search-results-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ color: '#6b6b6b', fontSize: '13px' }}>
              {isLoading ? 'Refreshing results...' : (activeCategory === 'All' ? 'Across all topics' : `Filtered by ${activeCategory}`)}
            </div>
            <div style={{ textAlign: 'right', color: '#6b6b6b', fontSize: '13px' }}>
              <div style={{ fontWeight: 700, fontSize: '18px' }}>{total}</div>
            </div>
          </div>
          <div className="search-grid">
            {isLoading ? (
              <>
                {[...Array(6)].map((_, i) => (
                  <SkeletonLoader key={`skeleton-${i}`} />
                ))}
              </>
            ) : (
              docs.map((doc) => (
                <Link key={doc.id} href={`/doc/${doc.id}`} className="search-card">
                  <div className="search-card-image-shell">
                    <img
                      src={resolveDocImage(doc.image, doc.id)}
                      alt={doc.title}
                      className="search-card-image"
                    />
                  </div>
                  <div className="search-card-body">
                    <div className="search-card-meta">
                      <span className="search-card-category">{doc.category || 'Article'}</span>
                      <span>{doc.readTime || '5 min read'}</span>
                    </div>
                    <h3 className="search-card-title">{doc.title}</h3>
                    <p>
                      {doc.description?.length > 180
                        ? `${doc.description.substring(0, 180)}...`
                        : doc.description || 'Professional guide on technical implementation and best practices for modern developers.'}
                    </p>
                    <div className="search-card-footer">
                      <div className="search-card-author">
                        <div className="search-card-avatar">
                          <img
                            src={resolveAuthorAvatar(doc.author_avatar, doc.author)}
                            alt={doc.author || 'Author'}
                          />
                        </div>
                        <span>{toTitleCase(doc.author)}</span>
                      </div>
                      <div className="search-card-dates">
                        {doc.created_at && (
                          <span>Published: {new Date(doc.created_at).toLocaleDateString()}</span>
                        )}
                        {doc.updated_at && doc.updated_at !== doc.created_at && (
                          <span>Updated: {new Date(doc.updated_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          {!isLoading && hasFetched && docs.length === 0 && (
            <div className="search-empty">
              <h3>No results matching your search</h3>
              <p>Try adjusting your filters or search keywords to find what you're looking for.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
