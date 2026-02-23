import { createClient, type Session, type User } from "@supabase/supabase-js";
import { db } from "../Components/characters/database/db";

/* =========================
	 CLIENT
========================= */

export const supabase = createClient(
	import.meta.env.VITE_SUPABASE_URL,
	import.meta.env.VITE_SUPABASE_ANON_KEY,
	import.meta.env.AZURE_REDIRECT
);

let currentSession: Session | null = null;
let remoteUserId: string | null = null;

/* =========================
	 AUTH
========================= */

export async function initSupabaseAuth(): Promise<User | null> {
	const { data } = await supabase.auth.getSession();
	currentSession = data.session;

	if (currentSession) {
		await ensureLocalUser();
		await ensureRemoteUser();
	}

	supabase.auth.onAuthStateChange(async (_event, session) => {
		currentSession = session;

		if (session) {
			await ensureLocalUser();
			await ensureRemoteUser();
		} else {
			remoteUserId = null;
		}
	});

	return currentSession?.user ?? null;
}

export async function loginWithDiscord() {
	await supabase.auth.signInWithOAuth({
		provider: "discord",
		options: { redirectTo: "AZURE_REDIRECT" }
	});
}

export async function logout() {
	await supabase.auth.signOut();
}

export function getCurrentUser(): User | null {
	return currentSession?.user ?? null;
}

export function getDiscordId(): string | null {
	const user = getCurrentUser();
	if (!user) return null;
	return user.user_metadata?.provider_id || user.id;
}

export function getRemoteUserId(): string | null {
	return remoteUserId;
}

/* =========================
	 LOCAL USER ENSURE
========================= */

async function ensureLocalUser() {
	const discordId = getDiscordId();
	if (!discordId) return;

	const existing = await db.users.get(discordId);
	if (!existing) {
		await db.users.put({
			discordId,
			updatedAt: Date.now(),
			isDirty: true,
			migratedFromBlob: false
		});
	}
}

/* =========================
	 REMOTE USER ENSURE
========================= */

async function ensureRemoteUser() {
	const discordId = getDiscordId();
	if (!discordId) return;

	const { data: existing } = await supabase
		.from("users")
		.select("*")
		.eq("discord_id", discordId)
		.single();

	if (existing) {
		remoteUserId = existing.id;
		return;
	}

	const { data } = await supabase
		.from("users")
		.insert({ discord_id: discordId })
		.select()
		.single();

	remoteUserId = data?.id ?? null;
}

/* =========================
	 GET LOGGED IN DISCORD USER
========================= */

export interface LoggedInDiscordUser {
	id: string;
	username: string;
	avatarUrl: string;
}

export async function getLoggedInDiscordUser(): Promise<LoggedInDiscordUser | null> {
	const user = getCurrentUser();
	if (!user) return null;

	// Build avatar URL from Discord metadata
	const discordId = user.user_metadata?.provider_id || user.id;
	const username = user.user_metadata?.full_name || user.user_metadata?.user_name || user.email || "Discord User";
	const avatarHash = user.user_metadata?.avatar_url || user.user_metadata?.avatar || null;

	let avatarUrl = "";

	if (avatarHash) {
		// Discord CDN avatar format
		avatarUrl = `${avatarHash}`;
	} else {
		// fallback: default avatar
		avatarUrl = `https://cdn.prod.website-files.com/6257adef93867e50d84d30e2/67d00cf7266d2c75571aebde_Example.svg`;
	}

	return {
		id: discordId,
		username,
		avatarUrl
	};
}