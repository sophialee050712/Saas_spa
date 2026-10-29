// Tien: DB bigint (VND), TypeScript number nguyen (BR-10).
// Khong dung float cho tien hay ti le. Ti le dung basis points (10% = 1000).
export const MAX_SAFE_VND = Number.MAX_SAFE_INTEGER;

export function toVnd(value: bigint | number | string): number {
  const parsed = typeof value === 'bigint' ? value : BigInt(value);
  if (parsed > BigInt(MAX_SAFE_VND) || parsed < BigInt(-MAX_SAFE_VND)) {
    throw new Error('VND_OUT_OF_SAFE_RANGE');
  }
  return Number(parsed);
}

export function toBigint(value: number): bigint {
  if (!Number.isSafeInteger(value)) {
    throw new Error('VND_NOT_SAFE_INTEGER');
  }
  return BigInt(value);
}

// Nhan/chia lam tron nua len, chi dung so nguyen (BR-11, AGENTS luat 6).
export function mulDivRound(amount: number, numerator: number, denominator: number): number {
  if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(numerator)) {
    throw new Error('VND_NOT_SAFE_INTEGER');
  }
  if (!Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new Error('INVALID_DENOMINATOR');
  }
  const result =
    (BigInt(amount) * BigInt(numerator) + BigInt(denominator / 2)) / BigInt(denominator);
  return toVnd(result);
}

export function formatVnd(amount: number): string {
  if (!Number.isSafeInteger(amount)) {
    throw new Error('VND_NOT_SAFE_INTEGER');
  }
  const sign = amount < 0 ? '-' : '';
  const digits = String(Math.abs(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${digits} ₫`;
}

// Lam tron tong cuoi den 1000d (BR-10). Chi goi o buoc tong cuoi, khong goi o tung dong.
export function roundToThousand(amount: number): number {
  if (!Number.isSafeInteger(amount)) {
    throw new Error('VND_NOT_SAFE_INTEGER');
  }
  return Math.round(amount / 1000) * 1000;
}
