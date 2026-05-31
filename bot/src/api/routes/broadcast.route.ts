import { Router } from "express";
import { db } from "../../db";
import { requireAuth } from "../middleware/auth.middleware";
import { broadcastMessage } from "../../services/notif.service";

const router = Router();
router.use(requireAuth);

// POST /broadcast
router.post("/", async (req, res) => {
  const { message, target, targetGroup } = req.body;
  const actualTarget = target || targetGroup;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message is required" });
  }

  let telegramIds: bigint[];

  if (actualTarget === "freelancers") {
    const freelancers = await db.freelancer.findMany({
      where: { status: "APPROVED" },
      select: { user: { select: { telegramId: true } } },
    });
    telegramIds = freelancers.map((f) => f.user.telegramId);
  } else {
    // All users who are NOT approved freelancers (drivers)
    const users = await db.user.findMany({
      where: {
        NOT: {
          freelancer: {
            status: "APPROVED",
          },
        },
      },
      select: { telegramId: true },
    });
    telegramIds = users.map((u) => u.telegramId);
  }

  const result = await broadcastMessage(
    telegramIds,
    `📢 <b>Info dari Admin</b>\n\n${message}`,
  );
  res.json({ success: true, ...result, total: telegramIds.length });
});

export default router;
