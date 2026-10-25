import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'What is your SaaS company worth? | Aspen Valuations',
  description: 'Estimate your company’s value using current SaaS market multiples.',
  applicationName: 'Aspen SaaS Valuation Calculator',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Aspen Valuation' },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#12302C',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-CA">
      <body>{children}</body>
    </html>
  );
}
