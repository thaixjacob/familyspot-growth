import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FamilySpot Growth',
  description: 'Growth + data dashboard for FamilySpot (GA4: web, blog, iOS, Android).',
  robots: { index: false, follow: false },
};

// Explicit viewport so the dashboard lays out at phone width instead of being
// rendered desktop-wide and zoomed out.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  );
}
