import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const hashPassword = (pw: string): string =>
  crypto.createHash('sha256').update(pw).digest('hex');

// Fixed temp password shown on every startup until admin changes it
const ADMIN_TEMP_PASSWORD = 'PesaMatrix@2026!';

export const seedAdminUser = async (): Promise<void> => {
  const adminEmail = 'craigphilip761@gmail.com';

  try {
    const existing = await prisma.user.findUnique({ where: { email: adminEmail } });

    if (!existing) {
      await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash: hashPassword(ADMIN_TEMP_PASSWORD),
          isAdmin: true,
          forcePasswordChange: true,
        }
      });
      console.log(`[Seed] Admin account created: ${adminEmail}`);
    } else if (!existing.isAdmin) {
      await prisma.user.update({
        where: { email: adminEmail },
        data: { isAdmin: true }
      });
      console.log(`[Seed] Elevated existing account to admin: ${adminEmail}`);
    }

    // Always remind if admin still hasn't changed their temp password
    const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (admin?.forcePasswordChange) {
      console.log('');
      console.log('╔══════════════════════════════════════════════════════╗');
      console.log('║           ADMIN TEMPORARY PASSWORD                  ║');
      console.log(`║  Email   : ${adminEmail.padEnd(42)}║`);
      console.log(`║  Password: ${ADMIN_TEMP_PASSWORD.padEnd(42)}║`);
      console.log('║  ⚠  Change this on first login via /change-password  ║');
      console.log('╚══════════════════════════════════════════════════════╝');
      console.log('');
    }

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
