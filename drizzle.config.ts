import { defineConfig } from "drizzle-kit";
import { env } from "./src/config/env";

export default defineConfig({
	schema: "./models/index.js",
	out: "./migrations",
	dialect: "postgresql",
	dbCredentials: {
		url: env.SUPABASE_DB_URL!,
	},
});
