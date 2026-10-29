import type { ReactNode } from 'react';
import { formatVnd } from '@spa-saas/shared';

// Hien thi tien: luon can phai, so deu, qua formatVnd duy nhat.
export function MoneyText({ amount }: { amount: number }): ReactNode {
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
      {formatVnd(amount)}
    </span>
  );
}
