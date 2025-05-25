import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { Users } from "./users.model.js";
import { Properties } from "./properties.model.js";

// Tracks who a property is currently delegated to (always a staff member)
export const StaffAssignments = pgTable("staff_assignments", {
	id: serial("id").primaryKey(),
	propertyId: integer("property_id")
		.references(() => Properties.id, { onDelete: "cascade" })
		.notNull()
		.unique(), // A property can only be delegated to ONE staff member
	staffId: integer("staff_id")
		.references(() => Users.id)
		.notNull(),
	assignedByCustodianId: integer("assigned_by_custodian_id") // The Custodian who delegated it
		.references(() => Users.id)
		.notNull(),
	assignedAt: timestamp("assigned_at").defaultNow().notNull(),
});
