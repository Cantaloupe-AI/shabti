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
            <h1 className="text-lg font-semibold tracking-tight">
              <span className="text-[var(--text-muted)]">𓂀</span> Shabti
            </h1>
            <span className="text-xs text-[var(--text-muted)]">
              dashboard
              {process.env.NEXT_PUBLIC_COMMIT_SHA && (
                <code className="ml-2 font-mono text-[10px] text-[var(--text-muted)] opacity-60">
                  {process.env.NEXT_PUBLIC_COMMIT_SHA}
                </code>
              )}
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
