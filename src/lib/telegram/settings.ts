import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { encryptText, decryptText } from '../crypto';

export type TelegramSettings = { enabled: boolean; token: string; secret: string; userId: string; allowedUsers: string[] };
const directory = path.join(process.cwd(), '.sessions');
const file = path.join(directory, 'telegram.enc');
export function readTelegramSettings(): TelegramSettings | null {
  if (!existsSync(file)) return null;
  return JSON.parse(decryptText(readFileSync(file, 'utf8')));
}
export function saveTelegramSettings(settings: TelegramSettings) {
  const encrypted = encryptText(JSON.stringify(settings));
  mkdirSync(directory, { recursive: true });
  writeFileSync(file + '.tmp', encrypted, { mode: 0o600 });
  renameSync(file + '.tmp', file);
}
