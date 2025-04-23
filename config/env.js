import { config } from "dotenv";
config({ path: `.env.${process.env.NODE_ENV || "development"}.local` });

export const {
	PORT,
	NODE_ENV,
	DB_URL,
	APPWRITE_PROJECT_ID,
	APPWRITE_BUCKET_ID,
	APPWRITE_ENDPOINT,
	JWT_SECRET,
	JWT_EXPIRES_IN,
	SUPABASE_DB_URL,
	SCANNER_SECRET_KEY,
} = process.env;
