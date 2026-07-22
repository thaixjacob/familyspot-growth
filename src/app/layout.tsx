import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FamilySpot Growth',
  description: 'Growth + data dashboard for FamilySpot (GA4: web, blog, iOS, Android).',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  );
}
