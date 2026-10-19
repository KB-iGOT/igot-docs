import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div style={{ padding: '60px 40px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--navy)' }}>Page not found</h1>
      <p style={{ color: 'var(--text-muted)' }}>That page doesn’t exist in the documentation.</p>
      <Link to="/" style={{ color: 'var(--brand)', fontWeight: 700 }}>Go to Home</Link>
    </div>
  );
}
