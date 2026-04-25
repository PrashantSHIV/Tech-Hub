import { type ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { LayoutDashboard, Search } from 'lucide-react';
import { getAuthEventName, getAuthSession } from '@/lib/auth';

type HeaderProps = {
	centerContent?: ReactNode;
};

export default function Header({ centerContent }: HeaderProps) {
	const { pathname } = useRouter();
	const [isLoggedIn, setIsLoggedIn] = useState(false);
	const isSearch = pathname === '/search' || pathname.startsWith('/doc');
	const isDashboard = pathname.startsWith('/admin');

	useEffect(() => {
		const syncSession = () => setIsLoggedIn(Boolean(getAuthSession()?.token));

		syncSession();
		window.addEventListener(getAuthEventName(), syncSession);
		window.addEventListener('storage', syncSession);

		return () => {
			window.removeEventListener(getAuthEventName(), syncSession);
			window.removeEventListener('storage', syncSession);
		};
	}, [pathname]);

	return (
		<header className="site-header">
			<div className={`site-header-shell${centerContent ? ' has-center-content' : ''}`}>
				<Link href="/" className="site-logo">Tech Hobby</Link>
				{centerContent ? (
					<div className="site-header-center">
						{centerContent}
					</div>
				) : null}
				<nav className="site-nav" aria-label="Primary">
					<Link href="/search" aria-label="Search" className={isSearch ? 'site-nav-link is-active' : 'site-nav-link'}>
						<Search className="site-nav-icon" size={22} strokeWidth={1.5} aria-hidden="true" />
					</Link>
					{isLoggedIn ? (
						<Link href="/admin/dashboard" aria-label="Dashboard" className={isDashboard ? 'site-nav-link is-active' : 'site-nav-link'}>
							<LayoutDashboard className="site-nav-icon" size={22} strokeWidth={1.5} aria-hidden="true" />
						</Link>
					) : null}
				</nav>
			</div>
		</header>
	);
}
