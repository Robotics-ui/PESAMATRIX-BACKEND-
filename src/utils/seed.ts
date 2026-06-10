import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const hashPassword = (pw: string): string =>
  crypto.createHash('sha256').update(pw).digest('hex');

export const seedAdminUser = async (): Promise<void> => {
  const adminEmail = 'craigphilip761@gmail.com';

  try {
    const existing = await prisma.user.findUnique({ where: { email: adminEmail } });

    if (!existing) {
      const tempPassword = crypto.randomBytes(12).toString('hex');
      await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash: hashPassword(tempPassword),
          isAdmin: true,
          forcePasswordChange: true,
        }
      });
      console.log(`[Seed] Admin account created: ${adminEmail}`);
      console.log(`[Seed] ⚠  Temporary password: ${tempPassword}  — MUST CHANGE ON FIRST LOGIN`);
    } else if (!existing.isAdmin) {
      await prisma.user.update({
        where: { email: adminEmail },
        data: { isAdmin: true }
      });
      console.log(`[Seed] Elevated existing account to admin: ${adminEmail}`);
    } else {
      console.log(`[Seed] Admin account already exists: ${adminEmail}`);
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
