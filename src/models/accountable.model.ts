import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { Users } from "./users.model.js";
import { Properties } from "./properties.model.js";

export const Accountable = pgTable("accountable", {
	id: serial("id").primaryKey(),
	userId: integer("user_id")
		.references(() => Users.id)
		.notNull(),
	propertyId: integer("property_id")
		.references(() => Properties.id)
		.notNull(),
	assignedAt: timestamp("assigned_at").defaultNow().notNull(),
});
