import { pgTable, serial, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { Users } from "./users.model.js";
import { Properties } from "./properties.model.js";

// Define statuses for a display job
export const displayJobStatusEnum = pgEnum("display_job_status", ["pending", "claimed", "completed", "failed"]);

// This table acts as a queue for display requests
export const DisplayJobs = pgTable("display_jobs", {
	id: serial("id").primaryKey(),
	propertyId: integer("property_id")
		.references(() => Properties.id, { onDelete: "cascade" })
		.notNull(),
	requestedBy: integer("requested_by")
		.references(() => Users.id)
		.notNull(),
	status: displayJobStatusEnum("status").default("pending").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	claimedAt: timestamp("claimed_at"),
});
