import { test, expect } from '@playwright/test';

test.describe('Shuttle Bot Admin Dashboard UI Tests', () => {

  test('Security - should redirect unauthenticated users to login page', async ({ page }) => {
    // Attempt to access dashboard overview
    await page.goto('/dashboard');
    await page.waitForURL('**/login');
    
    // Expect login elements to be visible
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#login-btn')).toBeVisible();
  });

  test('Auth & Shell Navigation - should log in and navigate the dashboard', async ({ page }) => {
    // 1. Visit Login
    await page.goto('/login');
    
    // 2. Fill login inputs
    await page.fill('#username', process.env.ADMIN_USERNAME || 'admin');
    await page.fill('#password', process.env.ADMIN_PASSWORD || 'adminpass123');
    
    // 3. Click Login
    await page.click('#login-btn');
    
    // 4. Verify redirected to dashboard
    await page.waitForURL('**/dashboard');
    await expect(page).toHaveTitle(/SHUTTLE BOT/i);
    
    // 5. Verify Sidebar and Topbar items
    await expect(page.locator('text=Core Operations')).toBeVisible();
    await expect(page.locator('text=admin_root')).toBeVisible();
    await expect(page.locator('text=API LINK:')).toBeVisible();
    
    // 6. Navigation: click Freelancers link
    await page.click('text=Freelancers');
    await page.waitForURL('**/dashboard/freelancers');
    await expect(page.locator('h1')).toHaveText('Freelancers Registry');
    
    // 7. Navigation: click Orders Log link
    await page.click('text=Orders Log');
    await page.waitForURL('**/dashboard/orders');
    await expect(page.locator('h1')).toHaveText('Operations Log');

    // 8. Navigation: click Incidents link
    await page.click('text=Incidents');
    await page.waitForURL('**/dashboard/reports');
    await expect(page.locator('h1')).toHaveText('Incident Reports');

    // 9. Navigation: click Broadcast link
    await page.click('text=Broadcast');
    await page.waitForURL('**/dashboard/broadcast');
    await expect(page.locator('h1')).toHaveText('Comm Dispatcher');
    await expect(page.locator('#broadcast-btn')).toBeVisible();
  });
});
