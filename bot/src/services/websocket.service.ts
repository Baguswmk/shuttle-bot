import { WebSocket, WebSocketServer } from 'ws';
import { getStatsData } from './stats.service';

let _wss: WebSocketServer | null = null;

export function setWebSocketServer(wss: WebSocketServer) {
  _wss = wss;

  _wss.on('connection', async (ws) => {
    console.log('[WS] Admin client connected');

    // Send initial stats on connection
    try {
      const stats = await getStatsData();
      ws.send(JSON.stringify({ type: 'STATS_UPDATE', data: stats }));
    } catch (err: any) {
      console.error('[WS] Failed to send initial stats:', err.message);
    }

    ws.on('close', () => {
      console.log('[WS] Admin client disconnected');
    });

    ws.on('error', (err) => {
      console.error('[WS] Client error:', err.message);
    });
  });
}

/**
 * Broadcast updated statistics to all open WebSocket connections
 */
export async function broadcastStats() {
  if (!_wss || _wss.clients.size === 0) return;

  try {
    const stats = await getStatsData();
    const payload = JSON.stringify({ type: 'STATS_UPDATE', data: stats });

    for (const client of _wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  } catch (err: any) {
    console.error('[WS] Broadcast stats failed:', err.message);
  }
}
