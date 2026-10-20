'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { APP_VERSION } from '@/lib/version';
import { partnerTypeLabel, teamLabel } from '@/lib/categories';
import { Avatar } from '@/components/ui';
import './Navbar.css';

const LINKS = [
  { name: 'Library', path: '/dashboard', icon: 'auto_stories', roles: ['trainer', 'trainee'] },
  { name: 'My learning', path: '/dashboard/my-learning', icon: 'school', roles: ['trainee'] },
  { name: 'Analytics', path: '/dashboard/analytics', icon: 'insights', roles: ['trainer'] },
  { name: 'People', path: '/dashboard/users', icon: 'group', roles: ['trainer'] },
];

export default function Navbar({ title }) {
  const { user, isTrainer, isPartner, partnerType, team, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef(null);

  const role = isTrainer ? 'trainer' : 'trainee';
  const links = LINKS.filter((l) => l.roles.includes(role));
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User';
  const firstName = displayName.split(' ')[0];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    router.push('/');
  };

  const isActive = (path) => pathname === path;

  return (
    <>
      {title && <title>{`${title} · Revibe Training`}</title>}
      <header className={`nav ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="nav-inner">
          <Link href="/dashboard" className="wordmark nav-brand" aria-label="Revibe Training home">
            <span className="wordmark-logo">REVIBE</span>
            <span className="wordmark-product">Training</span>
          </Link>
          <span className="nav-version" title={`App version ${APP_VERSION}`}>v{APP_VERSION}</span>

          <nav className="nav-links" aria-label="Main">
            {links.map((link) => (
              <Link
                key={link.path}
                href={link.path}
                className={`nav-link ${isActive(link.path) ? 'active' : ''}`}
                aria-current={isActive(link.path) ? 'page' : undefined}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          <div className="nav-user" ref={menuRef}>
            <button
              className={`nav-user-btn ${menuOpen ? 'open' : ''}`}
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <Avatar src={user?.photoURL} name={displayName} size={34} />
              <span className="nav-user-meta">
                <span className="nav-user-name">{firstName}</span>
                <span className={`nav-user-role ${role}`}>{isTrainer ? 'Trainer' : (isPartner ? (partnerTypeLabel(partnerType) || 'Partner') : (teamLabel(team) || 'Trainee'))}</span>
              </span>
              <i className="material-icons nav-user-caret">expand_more</i>
            </button>

            {menuOpen && (
              <div className="nav-menu" role="menu">
                <div className="nav-menu-head">
                  <Avatar src={user?.photoURL} name={displayName} size={42} />
                  <div style={{ minWidth: 0 }}>
                    <div className="nav-menu-name">{displayName}</div>
                    <div className="nav-menu-email">{user?.email}</div>
                  </div>
                </div>
                <div className="nav-menu-sep" />
                {!isTrainer && (
                  <Link href="/dashboard/my-learning#badges" className="nav-menu-item" role="menuitem" onClick={() => setMenuOpen(false)}>
                    <i className="material-icons">workspace_premium</i> Badges & certificates
                  </Link>
                )}
                <button className="nav-menu-item danger" role="menuitem" onClick={handleSignOut}>
                  <i className="material-icons">logout</i> Sign out
                </button>
                <div className="nav-menu-foot">Revibe Training Hub · v{APP_VERSION}</div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Phone tab bar */}
      <nav className="tabbar" aria-label="Main">
        {links.map((link) => (
          <Link
            key={link.path}
            href={link.path}
            className={`tabbar-link ${isActive(link.path) ? 'active' : ''}`}
            aria-current={isActive(link.path) ? 'page' : undefined}
          >
            <i className="material-icons">{link.icon}</i>
            <span>{link.name}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
