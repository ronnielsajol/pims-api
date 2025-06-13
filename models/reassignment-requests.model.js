import { pgTable, serial, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { Users } from "./users.model.js";
import { Properties } from "./properties.model.js";

// Define the possible statuses for a reassignment request
export const reassignmentStatusEnum = pgEnum("reassignment_status", ["pending", "approved", "denied"]);

export const ReassignmentRequests = pgTable("reassignment_requests", {
	id: serial("id").primaryKey(),
	propertyId: integer("property_id")
		.references(() => Properties.id, { onDelete: "cascade" })
		.notNull(),

	// The staff member who currently has the property
	fromStaffId: integer("from_staff_id")
		.references(() => Users.id)
		.notNull(),

	// The staff member the property is being reassigned TO
	toStaffId: integer("to_staff_id")
		.references(() => Users.id)
		.notNull(),

	// The custodian who initiated the request
	requestedByCustodianId: integer("requested_by_custodian_id")
		.references(() => Users.id)
		.notNull(),

	status: reassignmentStatusEnum("status").default("pending").notNull(),

	// Who reviewed the request (only master_admin)
	reviewedByMasterAdminId: integer("reviewed_by_master_admin_id").references(() => Users.id),

	reviewedAt: timestamp("reviewed_at"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});
