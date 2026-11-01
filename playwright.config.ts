import { defineConfig, devices } from '@playwright/test';

process.loadEnvFile('.env.test');
const PORT = 4180;

export default defineConfig({
	testDir: 'tests/e2e',
	globalSetup: './tests/e2e/global-setup.ts',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: 'on-first-retry'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		// Production build served by adapter-node; inherits the .env.test variables loaded above.
		command: `npm run build && node build`,
		port: PORT,
		env: { PORT: String(PORT) },
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	}
});
