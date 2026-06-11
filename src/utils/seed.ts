import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const hashPassword = (pw: string): string =>
  crypto.createHash('sha256').update(pw).digest('hex');

const ADMIN_EMAIL = 'craigphilip761@gmail.com';
const ADMIN_TEMP_PASSWORD = 'PesaMatrix@2026!';

export const seedAdminUser = async (): Promise<void> => {
  try {
    const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });

    if (!existing) {
      // First ever run — create admin with temp password
      await prisma.user.create({
        data: {
          email: ADMIN_EMAIL,
          passwordHash: hashPassword(ADMIN_TEMP_PASSWORD),
          isAdmin: true,
          forcePasswordChange: true,
        }
      });
      console.log(`[Seed] Admin account created: ${ADMIN_EMAIL}`);
    } else {
      // Admin exists — ensure isAdmin is set and reset password on every deploy
      // so that after a redeploy, a known credential is always available.
      // The admin MUST change their password after each deployment.
      await prisma.user.update({
        where: { email: ADMIN_EMAIL },
        data: {
          isAdmin: true,
          passwordHash: hashPassword(ADMIN_TEMP_PASSWORD),
          forcePasswordChange: true,
        }
      });
      console.log(`[Seed] Admin credentials refreshed for deploy.`);
    }

    // Always print temp credentials on startup — admin must change on first login
    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║           ADMIN TEMPORARY PASSWORD                  ║');
    console.log(`║  Email   : ${ADMIN_EMAIL.padEnd(42)}║`);
    console.log(`║  Password: ${ADMIN_TEMP_PASSWORD.padEnd(42)}║`);
    console.log('║  ⚠  Change this immediately via /change-password     ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('');

    // Default subscription settings
    const settingsCount = await prisma.subscriptionSettings.count();
    if (settingsCount === 0) {
      await prisma.subscriptionSettings.create({
        data: { feePerDay: 100.0, minDays: 1, maxDays: 30 }
      });
      console.log('[Seed] Default subscription settings created (100 KES/day, 1–30 days).');
    }
  } catch (err: any) {
    console.error('[Seed] Seeding failed:', err.message);
  }
};
