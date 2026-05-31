import { z } from 'zod';
import dotenv from 'dotenv';
dotenv.config({ override: process.env.NODE_ENV !== 'test' });

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN required'),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  ADMIN_USERNAME: z.string().default('admin'),
  ADMIN_PASSWORD: z.string().min(8),
  PORT: z.coerce.number().default(3002),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  WEBHOOK_URL: z.string().url().optional().or(z.literal('')),

  // ── Campus / instance config ────────────────────────────────────────────
  BOT_NAME:       z.string().default('Shuttle Bot'),
  CAMPUS_NAME:    z.string().default('Kampus'),
  CAMPUS_CITY:    z.string().default('Kota'),
  PICKUP_EXAMPLE: z.string().default('Gedung A, Kampus'),
  STORAGE_PREFIX: z.string().default('shuttle'),
  DRIVER_ZONES:   z.string().default('Kampus Utama'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment config:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const config = parsed.data;
