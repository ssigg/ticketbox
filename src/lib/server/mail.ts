import nodemailer from 'nodemailer';
import { env } from './env';
import { m } from '../paraglide/messages.js';
import type { Locale } from '../paraglide/runtime.js';

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

export async function sendPasswordResetMail(to: string, link: string, locale?: Locale): Promise<void> {
	await sendMail({
		to,
		subject: m.reset_mail_subject({}, { locale }),
		text: m.reset_mail_body({ link }, { locale })
	});
}
