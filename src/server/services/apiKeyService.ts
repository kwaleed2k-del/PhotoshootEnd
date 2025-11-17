/**
 * API key management service (server-only).
 */
import crypto from 'crypto';
import { admin } from '../supabaseAdmin';

export interface ApiKeyRow {
	id: string;
	user_id: string;
	name: string;
	key_prefix: string;
	revoked: boolean;
	last_used_at: string | null;
	created_at: string;
}

export interface CreatedKey {
	id: string;
	key: string;
	prefix: string;
}

export function hashKey(key: string): string {
	return crypto.createHash('sha256').update(key).digest('hex');
}

function toBase64Url(buf: Buffer) {
	return buf
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

export function generateKey(): { key: string; prefix: string; hash: string } {
	const raw = toBase64Url(crypto.randomBytes(32));
	const prefix = raw.slice(0, 8);
	const key = `pk_${prefix}.${raw}`;
	return { key, prefix, hash: hashKey(key) };
}

export async function createKeyForUser(userId: string, name: string): Promise<CreatedKey> {
	const { key, prefix, hash } = generateKey();
	const { data, error } = await admin
		.from('api_keys')
		.insert({
			user_id: userId,
			name,
			key_hash: hash,
			key_prefix: prefix,
			revoked: false
		})
		.select('id')
		.single();
	if (error) {
		throw error;
	}
	return { id: data.id as string, key, prefix };
}

export async function listKeys(userId: string): Promise<ApiKeyRow[]> {
	const { data, error } = await admin
		.from('api_keys')
		.select('id, user_id, name, key_prefix, revoked, last_used_at, created_at')
		.eq('user_id', userId)
		.order('created_at', { ascending: false });
	if (error) throw error;
	return (data ?? []) as ApiKeyRow[];
}

export async function revokeKey(userId: string, id: string): Promise<void> {
	const { error } = await admin
		.from('api_keys')
		.update({ revoked: true })
		.eq('user_id', userId)
		.eq('id', id);
	if (error) throw error;
}

export async function touchLastUsed(id: string): Promise<void> {
	const { error } = await admin
		.from('api_keys')
		.update({ last_used_at: new Date().toISOString() })
		.eq('id', id);
	if (error) throw error;
}

export async function findUserIdByKey(
	key: string
): Promise<{ userId: string; keyId: string } | null> {
	const hashed = hashKey(key);
	const { data, error } = await admin
		.from('api_keys')
		.select('id, user_id')
		.eq('key_hash', hashed)
		.eq('revoked', false)
		.limit(1)
		.single();
	if (error) {
		if (error.code === 'PGRST116') return null;
		throw error;
	}
	if (!data) return null;
	return { userId: data.user_id as string, keyId: data.id as string };
}


