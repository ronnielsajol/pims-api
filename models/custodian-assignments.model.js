import { pgTable, serial, integer, timestamp, text } from "drizzle-orm/pg-core";
import { Users } from "./users.model.js";
import { Properties } from "./properties.model.js";

// Tracks the primary accountable person (always a custodian)
export const CustodianAssignments = pgTable("custodian_assignments", {
	id: serial("id").primaryKey(),
	propertyId: integer("property_id")
		.references(() => Properties.id, { onDelete: "cascade" })
		.notNull()
		.unique(), // A property can only have ONE primary custodian
	custodianId: integer("custodian_id")
		.references(() => Users.id)
		.notNull(),
	assignedBy: integer("assigned_by") // The Admin who assigned it
		.references(() => Users.id)
		.notNull(),
	assigned_department: text("assigned_department").notNull(), // The department of the custodian
	assignedAt: timestamp("assigned_at").defaultNow().notNull(),
});
