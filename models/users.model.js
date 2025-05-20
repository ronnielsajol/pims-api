import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const Users = pgTable("users", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	password: text("password").notNull(),
	role: text("role").notNull().default("user"), // 'admin', 'staff', or 'user'
	location: text("location"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});
