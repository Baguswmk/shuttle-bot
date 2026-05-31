#!/usr/bin/env node
/**
 * Bot Session Stress Test
 *
 * Simulates many concurrent users interacting with the Telegram bot
 * via the Prisma session storage layer (PostgreSQL).
 *
 * This test bypasses Telegram API and hits the DB directly,
 * measuring session read/write/delete throughput.
 *
 * Run: node tests/stress/session.stress.mjs
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const CONCURRENT_USERS  = 200;   // Simulated simultaneous users
const OPS_PER_USER      = 10;    // Session read+write cycles per user
const TARGET_P95_MS     = 100;   // Alert if p95 > 100ms

async function simulateUserSession(userId: number) {
  const key     = `stress_user_${userId}`;
  const results: number[] = [];

  for (let i = 0; i < OPS_PER_USER; i++) {
    const start = Date.now();

    // Write session
    await db.botSession.upsert({
      where:  { id: key },
      create: { id: key, data: JSON.stringify({ step: `step_${i}`, orderDraft: { type: 'ANJEM' } }) },
      update: { data: JSON.stringify({ step: `step_${i}`, orderDraft: { type: 'ANJEM' } }) },
    });

    // Read session
    await db.botSession.findUnique({ where: { id: key } });

    results.push(Date.now() - start);
  }

  // Cleanup
  await db.botSession.deleteMany({ where: { id: key } });
  return results;
}

async function main() {
  console.log(`\n🔥 Bot Session Stress Test`);
  console.log(`   Concurrent users : ${CONCURRENT_USERS}`);
  console.log(`   Ops per user     : ${OPS_PER_USER}`);
  console.log(`   Total ops        : ${CONCURRENT_USERS * OPS_PER_USER}\n`);

  await db.$connect();

  const startAll = Date.now();

  // Fire all users concurrently
  const allResults = await Promise.all(
    Array.from({ length: CONCURRENT_USERS }, (_, i) => simulateUserSession(i)),
  );

  const totalMs  = Date.now() - startAll;
  const allTimes = allResults.flat().sort((a, b) => a - b);
  const p50      = allTimes[Math.floor(allTimes.length * 0.50)];
  const p95      = allTimes[Math.floor(allTimes.length * 0.95)];
  const p99      = allTimes[Math.floor(allTimes.length * 0.99)];
  const maxTime  = allTimes[allTimes.length - 1];
  const avgTime  = Math.round(allTimes.reduce((a, b) => a + b, 0) / allTimes.length);

  console.log(`📊 Results:`);
  console.log(`   Total wall time : ${totalMs}ms`);
  console.log(`   Avg latency     : ${avgTime}ms`);
  console.log(`   P50             : ${p50}ms`);
  console.log(`   P95             : ${p95}ms  ${p95 > TARGET_P95_MS ? '⚠️  ABOVE TARGET' : '✅'}`);
  console.log(`   P99             : ${p99}ms`);
  console.log(`   Max             : ${maxTime}ms`);
  console.log(`   Throughput      : ${Math.round((CONCURRENT_USERS * OPS_PER_USER * 1000) / totalMs)} ops/sec\n`);

  if (p95 > TARGET_P95_MS) {
    console.error(`❌ P95 (${p95}ms) exceeds target (${TARGET_P95_MS}ms). Consider:\n` +
      `   - Increasing Prisma connection pool size (DATABASE_URL?connection_limit=N)\n` +
      `   - Adding Redis session cache layer\n` +
      `   - Optimizing BotSession table indexes\n`);
    process.exit(1);
  } else {
    console.log(`✅ All targets met!`);
  }

  await db.$disconnect();
}

main().catch((err) => {
  console.error('[Stress] Fatal:', err);
  process.exit(1);
});
