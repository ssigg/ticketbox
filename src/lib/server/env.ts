// Server config comes from process.env so the same modules work inside SvelteKit,
// in scripts and in Vitest. `.env` is loaded as a fallback for `vite dev`.
if (!process.env.DATABASE_URL) {
	try {
		process.loadEnvFile('.env');
	} catch {
		// no .env file — rely on the real environment
	}
}

function required(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`Missing environment variable ${name}`);
	return value;
}

export const env = {
	databaseUrl: required('DATABASE_URL'),
	smtpHost: process.env.SMTP_HOST ?? 'localhost',
	smtpPort: Number(process.env.SMTP_PORT ?? 2501),
	mailFrom: process.env.MAIL_FROM ?? 'ticketbox@localhost',
	origin: process.env.ORIGIN ?? 'http://localhost:5180'
};
