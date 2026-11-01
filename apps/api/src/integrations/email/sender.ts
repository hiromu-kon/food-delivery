export type AuthEmail = { to: string; subject: string; text: string };
export interface EmailSender {
  send(message: AuthEmail): Promise<void>;
}
