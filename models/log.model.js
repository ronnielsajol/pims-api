import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.model.js";
import { properties } from "./properties.model.js";

export const logs = pgTable("logs", {
	id: serial("id").primaryKey(),
	action: text("action").notNull(), // e.g., 'assigned', 'transferred', 'added'
	userId: integer("user_id")
		.references(() => users.id)
		.notNull(),
	propertyId: integer("property_id")
		.references(() => properties.id)
		.notNull(),
	timestamp: timestamp("timestamp").defaultNow().notNull(),
});
