import { drizzle } from "drizzle-orm/postgres-js";
import { env } from "../config/env.js";
import postgres from "postgres";

if (!env.SUPABASE_DB_URL) {
	throw new Error("SUPABASE_DB_URL is required");
}
export const client = postgres(env.SUPABASE_DB_URL, { prepare: false });

export const db = drizzle(client);

export const checkDBConnection = async () => {
	try {
		await client`SELECT 1`;
		console.log("✅ Database connected successfully");
	} catch (error) {
		console.error("❌ Database connection failed:", error);
		process.exit(1);
	}
};
