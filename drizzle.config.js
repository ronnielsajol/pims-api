import { defineConfig } from "drizzle-kit";
import { SUPABASE_DB_URL } from "./config/env";

export default defineConfig({
	schema: "./models/index.js",
	out: "./migrations",
	dialect: "postgresql",
	dbCredentials: {
		url: SUPABASE_DB_URL,
	},
});
