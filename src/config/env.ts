import { config } from "dotenv";
config({ path: `.env.${process.env.NODE_ENV || "development"}.local` });

const requiredEnvVars = [
	"PORT",
	"NODE_ENV",
	"APPWRITE_PROJECT_ID",
	"APPWRITE_BUCKET_ID",
	"APPWRITE_API_ENDPOINT",
	"JWT_SECRET",
	"JWT_EXPIRES_IN",
	"SUPABASE_DB_URL",
	"SCANNER_SECRET_KEY",
] as const;

function getRequiredEnv(key: (typeof requiredEnvVars)[number]): string {
	const value = process.env[key];
	if (!value) {
		throw new Error(`❌ Missing required environment variable: ${key}`);
	}
	return value;
}

function getEnvString(key: string): string {
	const val = process.env[key];
	if (!val) throw new Error(`Missing env var: ${key}`);
	return val;
}

export const env = {
	PORT: getRequiredEnv("PORT"),
	NODE_ENV: getRequiredEnv("NODE_ENV") as "development" | "production" | "test",
	APPWRITE_PROJECT_ID: getRequiredEnv("APPWRITE_PROJECT_ID"),
	APPWRITE_BUCKET_ID: getRequiredEnv("APPWRITE_BUCKET_ID"),
	APPWRITE_API_ENDPOINT: getRequiredEnv("APPWRITE_API_ENDPOINT"),
	JWT_SECRET: getRequiredEnv("JWT_SECRET"),
	JWT_EXPIRES_IN: getEnvString("JWT_EXPIRES_IN") as string,
	SUPABASE_DB_URL: getRequiredEnv("SUPABASE_DB_URL"),
	SCANNER_SECRET_KEY: getRequiredEnv("SCANNER_SECRET_KEY"),
};
