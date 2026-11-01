// Minimal client for the Inbucket REST API (https://github.com/inbucket/inbucket/wiki/REST-API).
const base = process.env.INBUCKET_URL ?? 'http://localhost:9001';

interface Message {
	id: string;
	subject: string;
	body: { text: string; html: string };
}

function mailbox(email: string) {
	return encodeURIComponent(email.split('@')[0]);
}

/** Waits for the newest message in the mailbox of `email`. */
export async function waitForMail(email: string, timeoutMs = 5000): Promise<Message> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const res = await fetch(`${base}/api/v1/mailbox/${mailbox(email)}`);
		const list = (await res.json()) as { id: string }[];
		if (list.length > 0) {
			const latest = list[list.length - 1];
			const msg = await fetch(`${base}/api/v1/mailbox/${mailbox(email)}/${latest.id}`);
			return (await msg.json()) as Message;
		}
		await new Promise((r) => setTimeout(r, 100));
	}
	throw new Error(`No mail for ${email} within ${timeoutMs}ms`);
}

export async function mailCount(email: string): Promise<number> {
	const res = await fetch(`${base}/api/v1/mailbox/${mailbox(email)}`);
	return ((await res.json()) as unknown[]).length;
}

export function extractLink(text: string): string {
	const match = text.match(/https?:\/\/\S+/);
	if (!match) throw new Error('No link in mail');
	return match[0];
}
