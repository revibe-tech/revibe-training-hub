'use client';

import Link from 'next/link';

/** The viewer's header: back to the library, the material's category and title, then its actions. */
export default function ViewerTopBar({ title, category, kind, children }) {
  return (
    <header className="vw-top">
      <Link href="/dashboard" className="vw-back" aria-label="Back to library" title="Back to library">
        <i className="material-icons" aria-hidden="true">arrow_back</i>
        <span className="vw-back-label">Library</span>
      </Link>
      <div className="vw-titleblock">
        <span className="vw-eyebrow">
          {category || 'Training'}
          {kind && <span className="vw-eyebrow-kind"> · {kind}</span>}
        </span>
        <h1 className="vw-title" title={title}>{title || 'Untitled material'}</h1>
      </div>
      <div className="vw-top-actions">
        {children}
      </div>
    </header>
  );
}
