import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import http from 'http';

const ROOT_DIR = path.resolve(__dirname, '..');
const BOT_DIR = path.join(ROOT_DIR, 'bot');
const ADMIN_DIR = path.join(ROOT_DIR, 'admin');

let botProcess: ChildProcess | null = null;
let adminProcess: ChildProcess | null = null;

// Helper to poll endpoint health
function waitOn(url: string, timeout = 30000): Promise<boolean> {
  const start = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      if (Date.now() - start > timeout) {
        resolve(false);
        return;
      }
      http.get(url, (res) => {
        if (res.statusCode === 200 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 404) {
          resolve(true);
        } else {
          setTimeout(check, 1000);
        }
      }).on('error', () => {
        setTimeout(check, 1000);
      });
    };
    check();
  });
}

async function main() {
  console.log('[E2E Runner] Starting E2E test orchestration...');

  // ── 1. Start Bot API Server ──
  console.log('[E2E Runner] Launching Bot & Express API server...');
  botProcess = spawn('npm', ['run', 'dev'], {
    cwd: BOT_DIR,
    shell: true,
    stdio: 'pipe',
    env: {
      ...process.env,
      PORT: '3008',
      NODE_ENV: 'test',
      JWT_SECRET: 'test_jwt_secret_must_be_32_characters_long',
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'adminpass123',
    }
  });

  botProcess.stdout?.on('data', (data) => {
    console.log(`[Bot API Out] ${data.toString().trim()}`);
  });

  botProcess.stderr?.on('data', (data) => {
    console.error(`[Bot API Err] ${data.toString().trim()}`);
  });

  botProcess.on('error', (err) => {
    console.error('[E2E Runner] Bot API spawn error:', err);
  });

  // ── 2. Start Admin Next.js Server ──
  console.log('[E2E Runner] Launching Next.js Admin Dashboard...');
  adminProcess = spawn('npx', ['next', 'dev', '-p', '3009'], {
    cwd: ADMIN_DIR,
    shell: true,
    stdio: 'pipe',
    env: {
      ...process.env,
      NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3008/api',
    }
  });

  adminProcess.stdout?.on('data', (data) => {
    console.log(`[Admin Dashboard Out] ${data.toString().trim()}`);
  });

  adminProcess.stderr?.on('data', (data) => {
    console.error(`[Admin Dashboard Err] ${data.toString().trim()}`);
  });

  adminProcess.on('error', (err) => {
    console.error('[E2E Runner] Next.js Dashboard spawn error:', err);
  });

  // ── 3. Wait for endpoints to become active ──
  console.log('[E2E Runner] Waiting for servers to be active...');
  const botReady = await waitOn('http://127.0.0.1:3008/health');
  const adminReady = await waitOn('http://127.0.0.1:3009/login');

  if (!botReady) {
    console.error('[E2E Runner] Timed out waiting for Bot API server to start.');
    cleanup(1);
    return;
  }

  if (!adminReady) {
    console.error('[E2E Runner] Timed out waiting for Next.js Admin Dashboard to start.');
    cleanup(1);
    return;
  }

  console.log('[E2E Runner] Both servers are ONLINE. Running Playwright test suite...');

  // ── 4. Run Playwright E2E Tests ──
  const playwright = spawn('npx', ['playwright', 'test'], {
    cwd: __dirname,
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'adminpass123',
      PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:3009',
      PLAYWRIGHT_BACKEND_URL: 'http://127.0.0.1:3008',
    }
  });

  playwright.on('close', (code) => {
    console.log(`[E2E Runner] Playwright completed with exit code: ${code}`);
    cleanup(code ?? 0);
  });
}

function cleanup(exitCode: number) {
  console.log('[E2E Runner] Tearing down spawned test environments...');
  
  if (botProcess) {
    console.log('[E2E Runner] Terminating Bot API server process...');
    botProcess.kill('SIGINT');
  }

  if (adminProcess) {
    console.log('[E2E Runner] Terminating Next.js Admin Dashboard process...');
    adminProcess.kill('SIGINT');
  }

  setTimeout(() => {
    process.exit(exitCode);
  }, 2000);
}

// Handle unexpected exits
process.on('SIGINT', () => cleanup(1));
process.on('SIGTERM', () => cleanup(1));

main().catch((err) => {
  console.error('[E2E Runner] Fatal orchestration error:', err);
  cleanup(1);
});
