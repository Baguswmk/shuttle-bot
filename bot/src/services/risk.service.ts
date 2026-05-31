import { db } from '../db';

/**
 * Recalculate risk score (0–100) based on valid reports and avg rating.
 * Persists the new score to the freelancer record.
 */
export async function recalculateRiskScore(freelancerId: string): Promise<number> {
  const [validReports, freelancer] = await Promise.all([
    db.report.count({ where: { freelancerId, status: 'VALID' } }),
    db.freelancer.findUnique({ where: { id: freelancerId }, select: { avgRating: true } }),
  ]);

  const avgRating = freelancer?.avgRating ?? 5;
  // Formula: each valid report adds 25 pts, low ratings add up to 25 pts
  const score = Math.min(100, validReports * 25 + Math.round((5 - avgRating) * 5));

  await db.freelancer.update({
    where: { id: freelancerId },
    data:  { riskScore: score },
  });

  return score;
}

/**
 * Auto-escalate sanctions based on valid report count.
 * Returns the sanction type applied, or null if none.
 */
export async function escalateSanction(
  freelancerId: string,
): Promise<'WARNING' | 'SUSPEND_7D' | null> {
  const validReports = await db.report.count({
    where: { freelancerId, status: 'VALID' },
  });

  if (validReports >= 3) {
    const suspendUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.$transaction([
      db.freelancer.update({
        where: { id: freelancerId },
        data:  { status: 'SUSPENDED', suspendedUntil: suspendUntil },
      }),
      db.sanction.create({
        data: {
          freelancerId,
          type:      'SUSPEND_7D',
          reason:    `Auto-suspend: ${validReports} laporan valid dalam periode berjalan`,
          expiresAt: suspendUntil,
        },
      }),
    ]);
    return 'SUSPEND_7D';
  }

  if (validReports >= 1) {
    await db.sanction.create({
      data: {
        freelancerId,
        type:   'WARNING',
        reason: `Peringatan otomatis: ${validReports} laporan valid`,
      },
    });
    return 'WARNING';
  }

  return null;
}

/**
 * Manually ban a freelancer (admin action).
 */
export async function banFreelancer(freelancerId: string, reason: string, adminNote?: string) {
  return db.$transaction([
    db.freelancer.update({
      where: { id: freelancerId },
      data:  { status: 'BANNED' },
    }),
    db.sanction.create({
      data: { freelancerId, type: 'BANNED', reason, adminNote: adminNote ?? null },
    }),
  ]);
}

/**
 * Lift a suspension if it has expired.
 */
export async function liftExpiredSuspensions() {
  const now = new Date();
  await db.freelancer.updateMany({
    where: {
      status:         'SUSPENDED',
      suspendedUntil: { lte: now },
    },
    data: {
      status:         'APPROVED',
      suspendedUntil: null,
    },
  });
}
