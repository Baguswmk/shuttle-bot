import { db } from '../db';

export async function getStatsData() {
  const [
    totalUsers,
    totalOrders,
    activeFreelancers,
    pendingFreelancers,
    activeOrders,
    reportsOpen,
    avgRatingResult,
    revenueResult,
  ] = await Promise.all([
    db.user.count(),
    db.order.count(),
    db.freelancer.count({ where: { status: 'APPROVED' } }),
    db.freelancer.count({ where: { status: 'PENDING' } }),
    db.order.count({ where: { status: { in: ['MATCHED', 'RUNNING'] } } }),
    db.report.count({ where: { status: 'PENDING' } }),
    db.freelancer.aggregate({ _avg: { avgRating: true } }),
    db.order.aggregate({
      _sum: { finalPrice: true },
      where: { status: 'DONE' },
    }),
  ]);

  // Orders per day for last 7 days with category breakdowns
  const dailyOrders = await Promise.all(
    Array.from({ length: 7 }, async (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      const dNext = new Date(d);
      dNext.setDate(dNext.getDate() + 1);

      const [total, anjem, jastip, jasa] = await Promise.all([
        db.order.count({ where: { createdAt: { gte: d, lt: dNext } } }),
        db.order.count({ where: { type: 'ANJEM', createdAt: { gte: d, lt: dNext } } }),
        db.order.count({ where: { type: 'JASTIP', createdAt: { gte: d, lt: dNext } } }),
        db.order.count({ where: { type: 'JASA', createdAt: { gte: d, lt: dNext } } }),
      ]);

      return {
        date: d.toISOString().slice(0, 10),
        total,
        ANJEM: anjem,
        JASTIP: jastip,
        JASA: jasa,
      };
    }),
  );

  return {
    totalUsers,
    activeFreelancers,
    pendingFreelancers,
    activeOrders,
    totalOrders,
    totalRevenue: revenueResult._sum.finalPrice ?? 0,
    avgRating: parseFloat((avgRatingResult._avg.avgRating ?? 0).toFixed(2)),
    charts: {
      dailyOrders,
    },
  };
}
