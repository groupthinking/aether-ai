import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Aether — Scene breakdown',
  description: 'Multimodal URL or upload → scene-by-scene analysis',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas text-ink antialiased font-sans">{children}</body>
    </html>
  );
}
