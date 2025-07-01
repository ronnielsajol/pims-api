import { pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["master_admin", "admin", "property_custodian", "staff", "developer"]);

export const Users = pgTable("users", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	password: text("password").notNull(),
	role: userRoleEnum("role").notNull(), // 'admin', 'staff', or 'user'
	department: text("department").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});
