import { defineConfig } from 'vitest/config';

process.loadEnvFile('.env.test');

export default defineConfig({
	test: {
		include: ['tests/integration/**/*.test.ts', 'src/**/*.test.ts'],
		globalSetup: ['tests/integration/global-setup.ts'],
		// Tests share one database; run files one after another.
		fileParallelism: false
	}
});
