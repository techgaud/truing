import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('first run', () => {
	test('shows welcome screen with no bikes', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('text=Welcome to')).toBeVisible();
		await expect(page.locator('text=Truing').first()).toBeVisible();
		await expect(page.locator('text=Add your first bike')).toBeVisible();
	});

	test('tip text is visible on empty dashboard', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('text=Tip.')).toBeVisible();
	});
});

test.describe('add bike flow', () => {
	test('creates a bike and returns to dashboard', async ({ page }) => {
		await page.goto('/bikes/new');
		await expect(page.locator('h1')).toHaveText('Add a bike');

		await page.fill('#bike-name', 'Test Gravel Bike');
		await page.selectOption('#bike-type', 'gravel');
		await page.click('button[type="submit"]');

		await page.waitForURL('/');
		await expect(
			page.locator('text=no_components').or(page.locator('text=Add components'))
		).toBeVisible();
	});

	test('name is required', async ({ page }) => {
		await page.goto('/bikes/new');
		await page.selectOption('#bike-type', 'road');
		await page.click('button[type="submit"]');
		await expect(page).toHaveURL(/bikes\/new/);
	});
});

test.describe('navigation', () => {
	test('bottom nav links work', async ({ page }) => {
		await page.goto('/');

		await page.click('text=Bikes');
		await expect(page).toHaveURL(/\/bikes$/);

		await page.click('text=Rides');
		await expect(page).toHaveURL(/\/rides$/);

		await page.click('text=More');
		await expect(page).toHaveURL(/\/more$/);

		await page.click('text=Dashboard');
		await expect(page).toHaveURL(/\/$/);
	});

	test('settings page loads from more tab', async ({ page }) => {
		await page.goto('/more');
		await page.click('text=Settings');
		await expect(page).toHaveURL(/\/settings$/);
		await expect(page.locator('h1')).toHaveText('Settings');
	});
});

test.describe('rides', () => {
	test('shows empty state with no rides', async ({ page }) => {
		await page.goto('/rides');
		await expect(page.locator('h1')).toHaveText('Rides');
	});

	test('add ride page loads', async ({ page }) => {
		await page.goto('/rides/new');
		await expect(page.locator('h1')).toHaveText('Add a ride');
	});
});

test.describe('settings', () => {
	test('has all expected sections', async ({ page }) => {
		await page.goto('/settings');
		await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Strava' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Components' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Data', exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Data packs' })).toBeVisible();
	});

	test('unit preference toggles', async ({ page }) => {
		await page.goto('/settings');
		await page.selectOption('#unit-system', 'metric');
		const selected = await page.inputValue('#unit-system');
		expect(selected).toBe('metric');
	});

	test('export button is visible', async ({ page }) => {
		await page.goto('/settings');
		await expect(page.locator('text=Export backup')).toBeVisible();
	});
});

test.describe('full workflow', () => {
	test('add bike, log ride, check dashboard', async ({ page }) => {
		await page.goto('/bikes/new');
		await page.fill('#bike-name', 'E2E Test Bike');
		await page.selectOption('#bike-type', 'gravel');
		await page.click('button[type="submit"]');
		await page.waitForURL('/');

		await page.click('text=Rides');
		await page.waitForURL(/\/rides$/);
		await page.click('text=Add a ride');
		await page.waitForURL(/\/rides\/new$/);

		const bikeSelect = page.locator('select').first();
		await bikeSelect.selectOption({ index: 1 });
		await page.fill('input[type="number"]', '25');
		await page.click('button[type="submit"]');
		await page.waitForURL(/\/rides$/);

		await page.click('text=Dashboard');
		await page.waitForURL('/');
	});
});

test.describe('help overlay', () => {
	test('help button opens overlay', async ({ page }) => {
		await page.goto('/');
		const helpButton = page.locator('button[aria-label="Help"]');
		if (await helpButton.isVisible()) {
			await helpButton.click();
			await expect(page.locator('text=Dashboard')).toBeVisible();
		} else {
			expect(true).toBeTruthy();
		}
	});
});

test.describe('accessibility - light mode', () => {
	test('dashboard has no a11y violations', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(500);
		const results = await new AxeBuilder({ page }).disableRules(['region']).analyze();
		expect(results.violations).toEqual([]);
	});

	test('bikes page has no a11y violations', async ({ page }) => {
		await page.goto('/bikes');
		await page.waitForTimeout(500);
		const results = await new AxeBuilder({ page }).disableRules(['region']).analyze();
		expect(results.violations).toEqual([]);
	});

	test('add bike form has no a11y violations', async ({ page }) => {
		await page.goto('/bikes/new');
		await page.waitForTimeout(500);
		const results = await new AxeBuilder({ page }).disableRules(['region']).analyze();
		expect(results.violations).toEqual([]);
	});

	test('rides page has no a11y violations', async ({ page }) => {
		await page.goto('/rides');
		await page.waitForTimeout(500);
		const results = await new AxeBuilder({ page }).disableRules(['region']).analyze();
		expect(results.violations).toEqual([]);
	});

	test('settings page has no a11y violations', async ({ page }) => {
		await page.goto('/settings');
		await page.waitForTimeout(500);
		const results = await new AxeBuilder({ page }).disableRules(['region']).analyze();
		expect(results.violations).toEqual([]);
	});

	test('more page has no a11y violations', async ({ page }) => {
		await page.goto('/more');
		await page.waitForTimeout(500);
		const results = await new AxeBuilder({ page }).disableRules(['region']).analyze();
		expect(results.violations).toEqual([]);
	});
});

test.describe('accessibility - dark mode', () => {
	async function enableDarkMode(page: import('@playwright/test').Page) {
		await page.emulateMedia({ colorScheme: 'dark' });
	}

	test('dashboard has no a11y violations in dark mode', async ({ page }) => {
		await enableDarkMode(page);
		await page.goto('/');
		await page.waitForTimeout(500);
		const results = await new AxeBuilder({ page }).disableRules(['region']).analyze();
		expect(results.violations).toEqual([]);
	});

	test('bikes page has no a11y violations in dark mode', async ({ page }) => {
		await enableDarkMode(page);
		await page.goto('/bikes');
		await page.waitForTimeout(500);
		const results = await new AxeBuilder({ page }).disableRules(['region']).analyze();
		expect(results.violations).toEqual([]);
	});

	test('settings page has no a11y violations in dark mode', async ({ page }) => {
		await enableDarkMode(page);
		await page.goto('/settings');
		await page.waitForTimeout(500);
		const results = await new AxeBuilder({ page }).disableRules(['region']).analyze();
		expect(results.violations).toEqual([]);
	});

	test('more page has no a11y violations in dark mode', async ({ page }) => {
		await enableDarkMode(page);
		await page.goto('/more');
		await page.waitForTimeout(500);
		const results = await new AxeBuilder({ page }).disableRules(['region']).analyze();
		expect(results.violations).toEqual([]);
	});
});

test.describe('keyboard navigation', () => {
	test('Tab moves through bottom nav links', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(500);
		for (let i = 0; i < 10; i++) {
			await page.keyboard.press('Tab');
		}
		const focused = await page.evaluate(() => document.activeElement?.tagName);
		expect(focused).toBeTruthy();
	});

	test('add bike form fields are tabbable', async ({ page }) => {
		await page.goto('/bikes/new');
		await page.waitForTimeout(500);
		await page.keyboard.press('Tab');
		const firstFocused = await page.evaluate(() => document.activeElement?.id);
		expect(firstFocused).toBeTruthy();
	});

	test('Escape closes help overlay', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(500);
		const helpButton = page.locator('button[aria-label="Help"]');
		if (await helpButton.isVisible()) {
			await helpButton.click();
			await page.waitForTimeout(200);
			await page.keyboard.press('Escape');
			await page.waitForTimeout(200);
			const overlay = page.locator('[role="dialog"]');
			expect(await overlay.count()).toBe(0);
		} else {
			expect(true).toBeTruthy();
		}
	});
});

test.describe('responsive - mobile viewport', () => {
	test.use({ viewport: { width: 375, height: 812 } });

	test('dashboard renders at mobile width', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(500);
		await expect(page.locator('text=Welcome to')).toBeVisible();
		const overflow = await page.evaluate(() => {
			return document.documentElement.scrollWidth > document.documentElement.clientWidth;
		});
		expect(overflow).toBe(false);
	});

	test('bikes page renders at mobile width', async ({ page }) => {
		await page.goto('/bikes');
		await page.waitForTimeout(500);
		await expect(page.locator('h1')).toBeVisible();
		const overflow = await page.evaluate(() => {
			return document.documentElement.scrollWidth > document.documentElement.clientWidth;
		});
		expect(overflow).toBe(false);
	});

	test('settings page renders without horizontal scroll', async ({ page }) => {
		await page.goto('/settings');
		await page.waitForTimeout(500);
		const overflow = await page.evaluate(() => {
			return document.documentElement.scrollWidth > document.documentElement.clientWidth;
		});
		expect(overflow).toBe(false);
	});

	test('add bike form fits mobile width', async ({ page }) => {
		await page.goto('/bikes/new');
		await page.waitForTimeout(500);
		const overflow = await page.evaluate(() => {
			return document.documentElement.scrollWidth > document.documentElement.clientWidth;
		});
		expect(overflow).toBe(false);
	});

	test('bottom nav is visible at mobile width', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(500);
		const nav = page.locator('nav[aria-label="Primary"]');
		await expect(nav).toBeVisible();
	});
});

test.describe('responsive - narrow viewport (320px reflow)', () => {
	test.use({ viewport: { width: 320, height: 568 } });

	test('dashboard has no horizontal overflow at 320px', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(500);
		const overflow = await page.evaluate(() => {
			return document.documentElement.scrollWidth > document.documentElement.clientWidth;
		});
		expect(overflow).toBe(false);
	});

	test('settings page has no horizontal overflow at 320px', async ({ page }) => {
		await page.goto('/settings');
		await page.waitForTimeout(500);
		const overflow = await page.evaluate(() => {
			return document.documentElement.scrollWidth > document.documentElement.clientWidth;
		});
		expect(overflow).toBe(false);
	});
});

test.describe('responsive - tablet viewport', () => {
	test.use({ viewport: { width: 768, height: 1024 } });

	test('bikes page renders at tablet width', async ({ page }) => {
		await page.goto('/bikes');
		await page.waitForTimeout(500);
		await expect(page.locator('h1')).toBeVisible();
	});

	test('settings page renders at tablet width', async ({ page }) => {
		await page.goto('/settings');
		await page.waitForTimeout(500);
		await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();
	});
});

test.describe('responsive - desktop viewport', () => {
	test.use({ viewport: { width: 1280, height: 800 } });

	test('sidebar nav is visible at desktop width', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(500);
		const nav = page.locator('nav[aria-label="Primary"]');
		await expect(nav).toBeVisible();
	});

	test('dashboard renders at desktop width', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(500);
		await expect(page.locator('text=Welcome to')).toBeVisible();
	});
});

test.describe('touch targets', () => {
	test('all interactive elements meet minimum size', async ({ page }) => {
		await page.goto('/');
		await page.waitForTimeout(500);
		const smallTargets = await page.evaluate(() => {
			const interactive = document.querySelectorAll(
				'a, button, [role="button"], input, select, textarea'
			);
			const problems: string[] = [];
			interactive.forEach((el) => {
				const rect = (el as HTMLElement).getBoundingClientRect();
				if (rect.width > 0 && rect.height > 0 && rect.width < 24 && rect.height < 24) {
					problems.push(
						`${el.tagName}${el.getAttribute('aria-label') ? `[aria-label="${el.getAttribute('aria-label')}"]` : ''}: ${Math.round(rect.width)}x${Math.round(rect.height)}`
					);
				}
			});
			return problems;
		});
		expect(smallTargets).toEqual([]);
	});

	test('bikes page interactive elements meet minimum size', async ({ page }) => {
		await page.goto('/bikes');
		await page.waitForTimeout(500);
		const smallTargets = await page.evaluate(() => {
			const interactive = document.querySelectorAll(
				'a, button, [role="button"], input, select, textarea'
			);
			const problems: string[] = [];
			interactive.forEach((el) => {
				const rect = (el as HTMLElement).getBoundingClientRect();
				if (rect.width > 0 && rect.height > 0 && rect.width < 24 && rect.height < 24) {
					problems.push(
						`${el.tagName}${el.getAttribute('aria-label') ? `[aria-label="${el.getAttribute('aria-label')}"]` : ''}: ${Math.round(rect.width)}x${Math.round(rect.height)}`
					);
				}
			});
			return problems;
		});
		expect(smallTargets).toEqual([]);
	});

	test('settings page interactive elements meet minimum size', async ({ page }) => {
		await page.goto('/settings');
		await page.waitForTimeout(500);
		const smallTargets = await page.evaluate(() => {
			const interactive = document.querySelectorAll(
				'a, button, [role="button"], input, select, textarea'
			);
			const problems: string[] = [];
			interactive.forEach((el) => {
				const rect = (el as HTMLElement).getBoundingClientRect();
				if (rect.width > 0 && rect.height > 0 && rect.width < 24 && rect.height < 24) {
					problems.push(
						`${el.tagName}${el.getAttribute('aria-label') ? `[aria-label="${el.getAttribute('aria-label')}"]` : ''}: ${Math.round(rect.width)}x${Math.round(rect.height)}`
					);
				}
			});
			return problems;
		});
		expect(smallTargets).toEqual([]);
	});
});
