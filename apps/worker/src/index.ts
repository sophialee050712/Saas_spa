import { SWEEPER_INTERVAL_MS, sweepOnce } from './sweeper.js';

// GĐ0: worker chi chay vong lap sweeper khi co DATABASE_URL.
// Chua co DB that trong VM nay nen main se thoat som voi thong bao ro rang,
// thay vi gia vo ket noi Redis/Postgres.
async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.log('worker GD0: DATABASE_URL chua dat, thoat (xem docs/GD0-README.md).');
    return;
  }
  console.log(
    'worker GD0: DATABASE_URL da dat nhung chua co adapter DB that; sweeper that o M12/M15.',
  );
  void sweepOnce;
  void SWEEPER_INTERVAL_MS;
}

void main();
