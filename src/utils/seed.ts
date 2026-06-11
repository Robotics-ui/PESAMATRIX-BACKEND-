import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const hashPassword = (pw: string): string =>
  crypto.createHash('sha256').update(pw).digest('hex');

const ADMIN_EMAIL = 'craigphilip761@gmail.com';
const ADMIN_TEMP_PASSWORD = 'PesaMatrix@2026!';

export const seedAdminUser = async (): Promise<void> => {
  console.log('[Seed] Starting admin seed...');
  const tempHash = hashPassword(ADMIN_TEMP_PASSWORD);
  console.log('[Seed] Temp hash computed:', tempHash.slice(0, 12) + '...');

  // Upsert: always set admin to known temp password on every deploy
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      isAdmin: true,
      passwordHash: tempHash,
      forcePasswordChange: true,
    },
    create: {
      email: ADMIN_EMAIL,
      isAdmin: true,
      passwordHash: tempHash,
      forcePasswordChange: true,
    },
  });

  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║           ADMIN TEMPORARY PASSWORD                  ║');
  console.log(`║  Email   : ${ADMIN_EMAIL.padEnd(42)}║`);
  console.log(`║  Password: ${ADMIN_TEMP_PASSWORD.padEnd(42)}║`);
  console.log('║  ⚠  Change this immediately via /change-password     ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');

  // Default subscription settings (idempotent)
  const settingsCount = await prisma.subscriptionSettings.count();
  if (settingsCount === 0) {
    await prisma.subscriptionSettings.create({
      data: { feePerDay: 100.0, minDays: 1, maxDays: 30 },
    });
    console.log('[Seed] Default subscription settings created.');
  }

  console.log('[Seed] Done.');
};
