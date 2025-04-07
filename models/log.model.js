import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { Users } from "./users.model.js";
import { Properties } from "./properties.model.js";

export const logs = pgTable("logs", {
	id: serial("id").primaryKey(),
	action: text("action").notNull(), // e.g., 'assigned', 'transferred', 'added'
	userId: integer("user_id")
		.references(() => Users.id)
		.notNull(),
	propertyId: integer("property_id")
		.references(() => Properties.id)
		.notNull(),
	timestamp: timestamp("timestamp").defaultNow().notNull(),
});
