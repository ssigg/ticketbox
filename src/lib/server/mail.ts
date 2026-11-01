import nodemailer from 'nodemailer';
import { env } from './env';

const transport = nodemailer.createTransport({
	host: env.smtpHost,
	port: env.smtpPort,
	secure: false
});

export interface Mail {
	to: string;
	subject: string;
	text: string;
	html?: string;
	attachments?: { filename: string; content: Buffer; contentType?: string }[];
}

export async function sendMail(mail: Mail): Promise<void> {
	await transport.sendMail({ from: env.mailFrom, ...mail });
}

export async function sendPasswordResetMail(to: string, token: string): Promise<void> {
	const link = `${env.origin}/admin/reset-password/${token}`;
	await sendMail({
		to,
		subject: 'Reset your Ticketbox password',
		text: `Use this link to set a new password (valid for 1 hour):\n\n${link}\n\nIf you did not request this, ignore this email.`
	});
}
