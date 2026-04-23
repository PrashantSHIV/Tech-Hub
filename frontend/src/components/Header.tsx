import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Search } from 'lucide-react';

type HeaderProps = {
	centerContent?: ReactNode;
};

export default function Header({ centerContent }: HeaderProps) {
	const { pathname } = useRouter();
	const isSearch = pathname === '/search' || pathname.startsWith('/doc');

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
				</nav>
			</div>
		</header>
	);
}

