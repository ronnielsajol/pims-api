import { defineConfig } from "drizzle-kit";
import { DB_URL } from "./config/env";

export default defineConfig({
	schema: "./models/index.js",
	out: "./migrations",
	dialect: "postgresql",
	dbCredentials: {
		url: DB_URL,
	},
});
