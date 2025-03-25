import { drizzle } from "drizzle-orm/node-postgres";
import { DB_URL } from "../config/env.js";
import pkg from "pg";

const { Pool } = pkg;

if (!DB_URL) {
	throw new Error("DB_URL is required");
}

const pool = new Pool({
	connectionString: DB_URL,
});

export const db = drizzle(pool);

const checkDBConnection = async () => {
	try {
		const client = await pool.connect();
		console.log("✅ Database connected successfully");
		client.release();
	} catch (error) {
		console.error("❌ Database connection failed:", error);
		process.exit(1);
	}
};

export default checkDBConnection;
