import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Shabti Dashboard',
  description: 'System status and scheduled tasks',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        <header className="border-b border-[var(--border)] px-6 py-4">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <div className="flex items-center gap-6">
              <h1 className="text-lg font-semibold tracking-tight">
                <a href="/" className="hover:opacity-80">
                  <span className="text-[var(--text-muted)]">𓂀</span> Shabti
                </a>
              </h1>
              <nav className="flex items-center gap-4 text-xs">
                <a
                  href="/"
                  className="text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
                >
                  Dashboard
                </a>
                <a
                  href="/terminal"
                  className="text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
                >
                  Terminal
                </a>
              </nav>
            </div>
            <span className="text-xs text-[var(--text-muted)]">
              {process.env.NEXT_PUBLIC_COMMIT_SHA && (
                <code className="font-mono text-[10px] text-[var(--text-muted)] opacity-60">
                  {process.env.NEXT_PUBLIC_COMMIT_SHA}
                </code>
              )}
            </span>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
