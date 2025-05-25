import { pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["master_admin", "admin", "property_custodian", "staff"]);

export const Users = pgTable("users", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	password: text("password").notNull(),
	role: userRoleEnum("role").notNull(), // 'admin', 'staff', or 'user'
	location: text("location"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});
