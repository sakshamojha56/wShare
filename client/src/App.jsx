import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { SenderView } from './components/SenderView';
import { ReceiverView } from './components/ReceiverView';
import './index.css';

function Header() {
  return (
    <header className="app-header">
      <div className="container">
        <Link to="/" className="app-logo" id="home-logo">
          <div className="app-logo__icon">⚡</div>
          <div>
            <div className="app-logo__name gradient-text">wShare</div>
            <div className="app-logo__tagline">Direct. Private. Fast.</div>
          </div>
        </Link>

        <div className="app-header__badges">
          <span className="header-badge">🔐 Zero-Server</span>
          <span className="header-badge">⚡ WebRTC</span>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="app-footer">
      <div className="container">
        <p>Files transfer directly between browsers — no data ever touches a server.</p>
        <p style={{ marginTop: 4 }}>
          Built with WebRTC · AES-256-GCM · SHA-256 verification
        </p>
      </div>
    </footer>
  );
}

function NotFound() {
  return (
    <div style={{ textAlign: 'center', padding: '60px 24px' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🌌</div>
      <h2 className="gradient-text">Room Not Found</h2>
      <p style={{ color: '#64748b', marginTop: 8, marginBottom: 24 }}>
        This room may have expired or the link is invalid.
      </p>
      <Link to="/" className="btn btn-primary">
        ← Start a New Transfer
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Header />

        <main className="app-main">
          <div className="container">
            <Routes>
              <Route path="/" element={<SenderView />} />
              <Route path="/receive/:roomId" element={<ReceiverView />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </main>

        <Footer />
      </div>

      <style>{`
        .app-layout {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        /* ── Header ── */
        .app-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(5, 8, 22, 0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          padding: 16px 0;
        }
        .app-header .container {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .app-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          color: inherit;
        }
        .app-logo__icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          box-shadow: 0 4px 16px rgba(99,102,241,0.4);
        }
        .app-logo__name {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }
        .app-logo__tagline {
          font-size: 11px;
          color: #475569;
          font-weight: 500;
          letter-spacing: 0.05em;
        }
        .app-header__badges {
          display: flex;
          gap: 8px;
        }
        .header-badge {
          font-size: 11px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          color: #64748b;
          white-space: nowrap;
        }

        /* ── Main ── */
        .app-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 48px 0 64px;
        }
        .app-main .container {
          flex: 1;
        }

        /* ── Footer ── */
        .app-footer {
          border-top: 1px solid rgba(255,255,255,0.05);
          padding: 24px 0;
          text-align: center;
        }
        .app-footer p {
          font-size: 12px;
          color: #334155;
          margin: 0;
        }

        @media (max-width: 480px) {
          .app-header__badges { display: none; }
          .app-main { padding: 28px 0 48px; }
        }
      `}</style>
    </BrowserRouter>
  );
}
