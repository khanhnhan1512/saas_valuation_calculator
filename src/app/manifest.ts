import type { MetadataRoute } from 'next';
import { SOURCE_BOOTH } from '@/config/valuation-config';

// Installed on the booth iPad via Share > Add to Home Screen.
// Phase 2 (public website): change start_url to '/'.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Aspen SaaS Valuation Calculator',
    short_name: 'Aspen Valuation',
    description: 'Estimate your company’s value using current SaaS market multiples.',
    start_url: `/?source=${SOURCE_BOOTH}&kiosk=1`,
    scope: '/',
    display: 'fullscreen',
    orientation: 'landscape',
    background_color: '#12302C',
    theme_color: '#12302C',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
