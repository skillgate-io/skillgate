/* 16.16: Robots.txt configuration */

import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/success', '/cancel'],
      },
    ],
    sitemap: 'https://skillgate.io/sitemap.xml',
  };
}
