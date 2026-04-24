import Link from 'next/link';

type AdminNavProps = {
  current: 'dashboard' | 'editor' | 'users' | 'avatars' | 'profile' | 'categories';
  role?: 'ADMIN' | 'MEMBER';
};

export default function AdminNav({ current, role }: AdminNavProps) {
  const links = [
    { key: 'dashboard', href: '/admin/dashboard', label: 'Dashboard' },
    { key: 'editor', href: '/admin/editor', label: 'Write' },
    { key: 'categories', href: '/admin/categories', label: 'Categories' },
    { key: 'profile', href: '/admin/profile', label: 'Profile' },
  ];

  if (role === 'ADMIN') {
    links.push({ key: 'users', href: '/admin/users', label: 'Users' });
    links.push({ key: 'avatars', href: '/admin/avatars', label: 'Avatar Library' });
  }

  return (
    <nav className="admin-subnav" aria-label="Admin navigation">
      {links.map((link) => (
        <Link
          key={link.key}
          href={link.href}
          className={`admin-subnav-link${current === link.key ? ' is-active' : ''}`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
