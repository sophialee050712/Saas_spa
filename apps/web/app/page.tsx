import type { ReactNode } from 'react';
import { Button, MoneyText, tokens } from '@spa-saas/ui';
import { formatTenantDateTime } from '@spa-saas/shared';

// Trang tong quan toi thieu GĐ0: chi hien thi trang thai, khong co nghiep vu.
// 5 trang thai man hinh day du se lam khi co API that (spec tung module).
export default function Home(): ReactNode {
  return (
    <main style={{ margin: '0 auto', maxWidth: 720, padding: 24 }}>
      <h1 style={{ fontSize: tokens.fontSizes[4] }}>Spa SaaS — GĐ0</h1>
      <p>Nen mong monorepo: Next.js + NestJS (core) + Postgres RLS + Redis.</p>
      <p>Gio hien tai (Asia/Ho_Chi_Minh): {formatTenantDateTime(new Date(), 'Asia/Ho_Chi_Minh')}</p>
      <p>
        Vi du hien thi tien: <MoneyText amount={1250000} />
      </p>
      <Button>Bat dau (stub GĐ0)</Button>
    </main>
  );
}
