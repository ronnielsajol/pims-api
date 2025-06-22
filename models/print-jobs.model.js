import { pgTable, serial, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { Users } from "./users.model.js";
import { Properties } from "./properties.model.js";

export const printJobStatusEnum = pgEnum("print_job_status", ["pending", "claimed", "completed", "failed"]);

export const PrintJobs = pgTable("print_jobs", {
	id: serial("id").primaryKey(),

	propertyId: integer("property_id")
		.references(() => Properties.id, { onDelete: "cascade" })
		.notNull(),

	requestedBy: integer("requested_by")
		.references(() => Users.id)
		.notNull(),

	status: printJobStatusEnum("status").default("pending").notNull(),

	createdAt: timestamp("created_at").defaultNow().notNull(),
	claimedAt: timestamp("claimed_at"),
});
