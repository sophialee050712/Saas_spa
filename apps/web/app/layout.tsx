import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { tokens } from '@spa-saas/ui';

export const metadata: Metadata = { title: 'Spa SaaS — GĐ0' };

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="vi">
      <body style={{ fontFamily: tokens.fontFamily, margin: 0 }}>{children}</body>
    </html>
  );
}
