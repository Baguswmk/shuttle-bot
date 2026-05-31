import { createBot } from './bot';
import { webhookCallback } from 'grammy';
import { config } from './config';
import { botConfig } from './bot.config';
import path from 'path';
import { db } from './db';
import { setBotInstance } from './services/notif.service';
import { liftExpiredSuspensions } from './services/risk.service';

// BigInt JSON serialization patch
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};
import { registerStartHandler }                    from './handlers/start.handler';
import { registerAnjemHandler }                    from './handlers/anjem.handler';
import { registerJastipHandler }                   from './handlers/jastip.handler';
import { registerJasaHandler }                     from './handlers/jasa.handler';
import { registerFreelancerRegistrationHandler }   from './handlers/register.handler';
import { registerReportHandler }                   from './handlers/report.handler';

// API
import express from 'express';
import cors    from 'cors';
import helmet  from 'helmet';
import apiRouter from './api/router';
import http from 'http';
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { setWebSocketServer } from './services/websocket.service';

async function main() {
  console.log(`[Startup] ${botConfig.name}`);

  // ── Database ──────────────────────────────────────────────────────────────
  await db.$connect();
  console.log('[DB] PostgreSQL connected');



  // ── Bot ───────────────────────────────────────────────────────────────────
  const bot = createBot();
  setBotInstance(bot);

  // Register all handlers
  registerStartHandler(bot);
  registerAnjemHandler(bot);
  registerJastipHandler(bot);
  registerJasaHandler(bot);
  registerFreelancerRegistrationHandler(bot);
  registerReportHandler(bot);

  // ── Express server ────────────────────────────────────────────────────────
  const app = express();
  app.use(express.json());
  app.use(cors());
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }));
  app.use('/uploads', express.static(path.resolve('uploads')));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status:    'ok',
      timestamp: new Date().toISOString(),
      env:       config.NODE_ENV,
    });
  });

  // Admin REST API
  app.use('/api', apiRouter);

  // Wrap Express app in HTTP server for WebSockets
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });
  setWebSocketServer(wss);

  server.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      if (url.pathname === '/api/ws') {
        const token = url.searchParams.get('token');
        if (!token) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        try {
          jwt.verify(token, config.JWT_SECRET);
        } catch (err) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
      }
    } catch (err) {
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  });

  // Webhook (production) or long polling (development)
  if (config.NODE_ENV === 'production' && config.WEBHOOK_URL) {
    app.use(webhookCallback(bot, 'express'));
    server.listen(config.PORT, () => {
      console.log(`[Server] Listening on port ${config.PORT}`);
    });
    await bot.api.setWebhook(`${config.WEBHOOK_URL}/webhook`);
    console.log(`[Bot] Webhook → ${config.WEBHOOK_URL}/webhook`);
  } else {
    server.listen(config.PORT, () => {
      console.log(`[Server] Listening on port ${config.PORT}`);
    });
    bot.start({
      onStart: (info) => {
        console.log(`[Bot] @${info.username} started (long polling)`);
        console.log(`[API] http://localhost:${config.PORT}/api`);
        console.log(`[WS] ws://localhost:${config.PORT}/api/ws`);
      },
    });
  }

  // ── Scheduled jobs ────────────────────────────────────────────────────────
  // Lift expired suspensions every hour
  setInterval(async () => {
    try {
      await liftExpiredSuspensions();
    } catch (err: any) {
      console.error('[Scheduler] liftExpiredSuspensions error:', err.message);
    }
  }, 60 * 60 * 1000);

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  async function shutdown(signal: string) {
    console.log(`\n[Shutdown] Received ${signal}, shutting down gracefully...`);
    await bot.stop();
    await db.$disconnect();
    process.exit(0);
  }

  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[Fatal]', err);
  process.exit(1);
});
