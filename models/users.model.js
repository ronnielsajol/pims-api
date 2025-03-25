import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	role: text("role").notNull().default("user"), // 'admin', 'staff', or 'user'
	createdAt: timestamp("created_at").defaultNow().notNull(),
});
