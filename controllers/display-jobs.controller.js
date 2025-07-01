// controllers/display-jobs.controller.js

import { aliasedTable, sql, eq, and, asc } from "drizzle-orm";
import { db } from "../database/supabase.js";
import { DisplayJobs } from "../models/display-jobs.model.js"; // Import the new model
import { Properties } from "../models/properties.model.js";
import { Users } from "../models/users.model.js";
import { CustodianAssignments } from "../models/custodian-assignments.model.js";
import { StaffAssignments } from "../models/staff-assignments.model.js";

/**
 * @desc    Queue a property to be displayed
 * @route   POST /api/v1/display-jobs/create
 * @access  Private
 */
export const createDisplayJob = async (req, res) => {
	const { propertyId } = req.body;
	const userId = req.user.id;

	if (!propertyId) {
		return res.status(400).json({ message: "Property ID is required." });
	}

	try {
		// Check if a job for this property is already pending
		const existingJob = await db
			.select()
			.from(DisplayJobs)
			.where(and(eq(DisplayJobs.propertyId, propertyId), eq(DisplayJobs.status, "pending")))
			.limit(1);

		if (existingJob.length > 0) {
			return res.status(409).json({ message: "A display job for this property is already pending." });
		}

		// Create the new display job
		const newJob = await db
			.insert(DisplayJobs)
			.values({
				propertyId,
				requestedBy: userId,
				status: "pending",
			})
			.returning();

		res.status(201).json({ message: "Display job created successfully.", data: newJob[0] });
	} catch (error) {
		console.error("Error creating display job:", error);
		res.status(500).json({ message: "Failed to create display job." });
	}
};

/**
 * @desc    Get the next available display job for a device
 * @route   GET /api/v1/display-jobs/next
 * @access  Public (for the polling device)
 */
export const getNextDisplayJob = async (req, res) => {
	try {
		// Use a transaction to find and claim the job atomically
		const job = await db.transaction(async (tx) => {
			const foundJob = await tx
				.select()
				.from(DisplayJobs)
				.where(eq(DisplayJobs.status, "pending"))
				.orderBy(asc(DisplayJobs.createdAt))
				.limit(1);

			if (foundJob.length === 0) {
				return null; // No jobs available
			}

			const jobToClaim = foundJob[0];

			// Mark the job as 'claimed'
			await tx.update(DisplayJobs).set({ status: "claimed", claimedAt: new Date() }).where(eq(DisplayJobs.id, jobToClaim.id));

			return jobToClaim;
		});

		if (!job) {
			// Send 204 No Content if queue is empty
			return res.status(204).send();
		}

		// --- Fetch the specific data for the claimed job ---
		const custodianUser = aliasedTable(Users, "custodian");
		const staffUser = aliasedTable(Users, "staff");

		const displayDataResult = await db
			.select({
				productNumber: Properties.propertyNo,
				description: Properties.description,
				accountablePerson: sql`COALESCE(${staffUser.name}, ${custodianUser.name})`,
			})
			.from(Properties)
			.where(eq(Properties.id, job.propertyId))
			.leftJoin(CustodianAssignments, eq(Properties.id, CustodianAssignments.propertyId))
			.leftJoin(custodianUser, eq(CustodianAssignments.custodianId, custodianUser.id))
			.leftJoin(StaffAssignments, eq(Properties.id, StaffAssignments.propertyId))
			.leftJoin(staffUser, eq(StaffAssignments.staffId, staffUser.id))
			.limit(1);

		if (displayDataResult.length === 0) {
			return res.status(404).json({ message: "Property for the claimed job not found." });
		}

		// Send the customized JSON object to the device
		res.status(200).json(displayDataResult[0]);
	} catch (error) {
		console.error("Error fetching next display job:", error);
		res.status(500).json({ message: "Server error while fetching display job." });
	}
};
