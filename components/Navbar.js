import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <div className="navbar-logo gradient-text">REVIBE</div>
        <div className="navbar-divider"></div>
        <div className="navbar-page-title">Training</div>
      </div>
    </nav>
  );
}
