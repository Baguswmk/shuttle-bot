# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin.spec.ts >> Shuttle Admin Dashboard UI Tests >> Auth & Shell Navigation - should log in and navigate the dashboard
- Location: e2e\admin.spec.ts:16:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForURL: Test timeout of 30000ms exceeded.
=========================== logs ===========================
waiting for navigation to "**/dashboard" until "load"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
    - main [ref=e2]:
        - generic [ref=e3]:
            - generic [ref=e4]:
                - img [ref=e6]
                - heading " SHUTTLE" [level=1] [ref=e8]
                - paragraph [ref=e9]: Operations Control Panel
            - generic [ref=e10]:
                - generic [ref=e11]:
                    - generic [ref=e12]: Operator Username
                    - textbox "Username" [ref=e13]: admin
                - generic [ref=e14]:
                    - generic [ref=e15]: Access Code
                    - generic [ref=e16]:
                        - textbox "••••••••" [ref=e17]: qwerty123908
                        - button [ref=e18]:
                            - img [ref=e19]
                - generic [ref=e22]: ⚠️ Failed to fetch
                - button "ESTABLISH SECURE LINK" [ref=e23] [cursor=pointer]
            - generic [ref=e24]: SECURE CHANNEL //  SHUTTLE DEPLOYMENT v2.0
    - button "Open Next.js Dev Tools" [ref=e30] [cursor=pointer]:
        - img [ref=e31]
    - alert [ref=e34]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  |
  3  | test.describe(' Shuttle Admin Dashboard UI Tests', () => {
  4  |
  5  |   test('Security - should redirect unauthenticated users to login page', async ({ page }) => {
  6  |     // Attempt to access dashboard overview
  7  |     await page.goto('/dashboard');
  8  |     await page.waitForURL('**/login');
  9  |
  10 |     // Expect login elements to be visible
  11 |     await expect(page.locator('#username')).toBeVisible();
  12 |     await expect(page.locator('#password')).toBeVisible();
  13 |     await expect(page.locator('#login-btn')).toBeVisible();
  14 |   });
  15 |
  16 |   test('Auth & Shell Navigation - should log in and navigate the dashboard', async ({ page }) => {
  17 |     // 1. Visit Login
  18 |     await page.goto('/login');
  19 |
  20 |     // 2. Fill login inputs
  21 |     await page.fill('#username', process.env.ADMIN_USERNAME || 'admin');
  22 |     await page.fill('#password', process.env.ADMIN_PASSWORD || 'adminpass123');
  23 |
  24 |     // 3. Click Login
  25 |     await page.click('#login-btn');
  26 |
  27 |     // 4. Verify redirected to dashboard
> 28 |     await page.waitForURL('**/dashboard');
     |                ^ Error: page.waitForURL: Test timeout of 30000ms exceeded.
  29 |     await expect(page).toHaveTitle(/ SHUTTLE/i);
  30 |
  31 |     // 5. Verify Sidebar and Topbar items
  32 |     await expect(page.locator('text=Core Operations')).toBeVisible();
  33 |     await expect(page.locator('text=admin_root')).toBeVisible();
  34 |     await expect(page.locator('text=API LINK:')).toBeVisible();
  35 |
  36 |     // 6. Navigation: click Freelancers link
  37 |     await page.click('text=Freelancers');
  38 |     await page.waitForURL('**/dashboard/freelancers');
  39 |     await expect(page.locator('h1')).toHaveText('Freelancers Registry');
  40 |
  41 |     // 7. Navigation: click Orders Log link
  42 |     await page.click('text=Orders Log');
  43 |     await page.waitForURL('**/dashboard/orders');
  44 |     await expect(page.locator('h1')).toHaveText('Operations Log');
  45 |
  46 |     // 8. Navigation: click Incidents link
  47 |     await page.click('text=Incidents');
  48 |     await page.waitForURL('**/dashboard/reports');
  49 |     await expect(page.locator('h1')).toHaveText('Incident Reports');
  50 |
  51 |     // 9. Navigation: click Broadcast link
  52 |     await page.click('text=Broadcast');
  53 |     await page.waitForURL('**/dashboard/broadcast');
  54 |     await expect(page.locator('h1')).toHaveText('Comm Dispatcher');
  55 |     await expect(page.locator('#broadcast-btn')).toBeVisible();
  56 |   });
  57 | });
  58 |
```
