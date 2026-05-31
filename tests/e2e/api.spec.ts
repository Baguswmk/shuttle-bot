import { test, expect } from '@playwright/test';

const BACKEND_URL = process.env.PLAYWRIGHT_BACKEND_URL || 'http://127.0.0.1:3002';

test.describe('Shuttle REST API E2E Tests', () => {
  let adminToken: string;

  // 1. Health check endpoint test
  test('GET /health - should return server health status', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/health`);
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.env).toBeDefined();
  });

  // 2. Auth login with invalid credentials
  test('POST /api/auth/login - should fail with invalid credentials', async ({ request }) => {
    const response = await request.post(`${BACKEND_URL}/api/auth/login`, {
      data: {
        username: 'wrong_operator',
        password: 'wrong_password',
      },
    });
    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Invalid credentials');
  });

  // 3. Auth login with valid credentials (using default env values or seed)
  test('POST /api/auth/login - should succeed and return JWT', async ({ request }) => {
    // Standard test admin config (matches default test configuration values)
    const response = await request.post(`${BACKEND_URL}/api/auth/login`, {
      data: {
        username: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD || 'adminpass123',
      },
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.token).toBeDefined();
    expect(data.expiresIn).toBeDefined();
    adminToken = data.token;
  });

  // 4. Secure route access without JWT
  test('GET /api/stats - should fail when unauthorized', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/stats`);
    expect(response.status()).toBe(401);
  });

  // 5. Secure stats retrieval with JWT
  test('GET /api/stats - should succeed when authorized', async ({ request }) => {
    test.skip(!adminToken, 'Requires successful login token');
    const response = await request.get(`${BACKEND_URL}/api/stats`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.totalUsers).toBeDefined();
    expect(data.activeFreelancers).toBeDefined();
    expect(data.activeOrders).toBeDefined();
    expect(data.totalOrders).toBeDefined();
    expect(data.charts).toBeDefined();
  });

  // 6. Secure freelancers retrieval with JWT
  test('GET /api/freelancers - should return freelancers array when authorized', async ({ request }) => {
    test.skip(!adminToken, 'Requires successful login token');
    const response = await request.get(`${BACKEND_URL}/api/freelancers`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  // 7. Secure orders log retrieval with JWT
  test('GET /api/orders - should return orders array when authorized', async ({ request }) => {
    test.skip(!adminToken, 'Requires successful login token');
    const response = await request.get(`${BACKEND_URL}/api/orders`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  // 8. Secure reports board retrieval with JWT
  test('GET /api/reports - should return reports array when authorized', async ({ request }) => {
    test.skip(!adminToken, 'Requires successful login token');
    const response = await request.get(`${BACKEND_URL}/api/reports`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });
});
