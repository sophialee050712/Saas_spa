import { describe, expect, it } from 'vitest';
import { formatVnd, mulDivRound, roundToThousand, toBigint, toVnd } from '../src/money';

describe('money', () => {
  it('[BR-10] toVnd giu nguyen so nguyen va nem loi khi vuot safe integer', () => {
    expect(toVnd(1250000n)).toBe(1250000);
    expect(toVnd('1000')).toBe(1000);
    expect(() => toVnd(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow('VND_OUT_OF_SAFE_RANGE');
  });
  it('[BR-10] toBigint nem loi khi khong phai so nguyen an toan', () => {
    expect(toBigint(500)).toBe(500n);
    expect(() => toBigint(1.5)).toThrow('VND_NOT_SAFE_INTEGER');
  });
  it('mulDivRound lam tron nua len bang so nguyen', () => {
    expect(mulDivRound(450000, 1000, 10000)).toBe(45000);
    expect(mulDivRound(1001, 1, 2)).toBe(501);
  });
  it('formatVnd dung dau cham ngan nghin va ky hieu dong', () => {
    expect(formatVnd(1250000)).toBe('1.250.000 ₫');
    expect(formatVnd(-5000)).toBe('-5.000 ₫');
  });
  it('[BR-10] roundToThousand chi dung o tong cuoi', () => {
    expect(roundToThousand(1250400)).toBe(1250000);
    expect(roundToThousand(1250500)).toBe(1251000);
  });
});
