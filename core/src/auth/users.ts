import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import type { User } from './types.ts';

export async function loadUsers(path: string): Promise<User[]> {
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('users.json must be an array');
  return parsed as User[];
}

export async function saveUsers(path: string, users: User[]): Promise<void> {
  writeFileSync(path, JSON.stringify(users, null, 2) + '\n');
  chmodSync(path, 0o600);
}
