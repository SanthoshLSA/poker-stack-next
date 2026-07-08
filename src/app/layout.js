import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";

export const metadata = {
  title: "PokerStack — Poker Session & Bankroll Manager",
  description: "Track chips, rebuys, and bankroll balances with 100% mathematical conservation. Keep your game night honest.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthProvider>
          <Navbar />
          <main style={{ minHeight: 'calc(100vh - 120px)' }}>
            {children}
          </main>
          <footer style={{
            textAlign: 'center',
            padding: '24px 16px',
            fontSize: '12px',
            color: 'var(--text-muted)',
            borderTop: '1px solid var(--border-subtle)',
            fontFamily: 'var(--font-display)',
            letterSpacing: '0.05em',
            background: 'rgba(7, 8, 13, 0.5)',
            position: 'relative',
            zIndex: 10
          }}>
            PokerStack Management App built by <span style={{ color: 'var(--color-gold)', fontWeight: '600' }}>Santhosh</span>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
