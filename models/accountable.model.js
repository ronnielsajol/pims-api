import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.model.js";
import { properties } from "./properties.model.js";

export const accountable = pgTable("accountable", {
	id: serial("id").primaryKey(),
	userId: integer("user_id")
		.references(() => users.id)
		.notNull(),
	propertyId: integer("property_id")
		.references(() => properties.id)
		.notNull(),
	assignedAt: timestamp("assigned_at").defaultNow().notNull(),
});
