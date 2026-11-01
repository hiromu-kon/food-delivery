import nodemailer from 'nodemailer';

import type { EmailSender } from './sender';

export function createSmtpSender(options: {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  from: string;
  user?: string | undefined;
  password?: string | undefined;
}): EmailSender {
  const transport = nodemailer.createTransport({
    host: options.host,
    port: options.port,
    secure: options.secure,
    requireTLS: options.requireTLS,
    ...(options.user &&
      options.password && { auth: { user: options.user, pass: options.password } }),
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return {
    async send(message) {
      await transport.sendMail({ from: options.from, ...message });
    },
  };
}
