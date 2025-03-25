import { config } from "dotenv";
config({ path: `.env.${process.env.NODE_ENV || "development"}.local` });

export const { PORT, NODE_ENV, DB_URL, APPWRITE_PROJECT_ID, APPWRITE_ENDPOINT } = process.env;
