import { db } from "../database/supabase.js";
import { PrintJobs } from "../models/print-jobs.model.js";
import { Properties } from "../models/properties.model.js";
import { eq, and, asc, desc, aliasedTable } from "drizzle-orm";
import { Users } from "../models/users.model.js";
import { PropertyDetails } from "../models/property-details.model.js";
import { CustodianAssignments } from "../models/custodian-assignments.model.js";

/**
 * @desc    Create a new print job for a property
 * @route   POST /api/print-jobs/create
 * @access  Private (Admin, Master Admin, Custodian)
 */
export const createPrintJob = async (req, res) => {
	const { propertyId } = req.body;
	const userId = req.user.id;

	if (!propertyId) {
		return res.status(400).json({ message: "Property ID is required." });
	}

	try {
		const existingJob = await db
			.select()
			.from(PrintJobs)
			.where(and(eq(PrintJobs.propertyId, propertyId), eq(PrintJobs.status, "pending")))
			.limit(1);

		if (existingJob.length > 0) {
			return res.status(409).json({ message: "A print job for this property is already pending." });
		}

		// Create the new print job
		const newJob = await db
			.insert(PrintJobs)
			.values({
				propertyId,
				requestedBy: userId,
				status: "pending",
			})
			.returning();

		res.status(201).json({ message: "Print job created successfully.", data: newJob[0] });
	} catch (error) {
		console.error("Error creating print job:", error);
		res.status(500).json({ message: "Failed to create print job." });
	}
};

/**
 * @desc    Get the next available print job for an ESP32
 * @route   GET /api/print-jobs/next
 * @access  Public (for the ESP32 device)
 */
export const getNextPrintJob = async (req, res) => {
	try {
		const job = await db.transaction(async (tx) => {
			const foundJob = await tx
				.select()
				.from(PrintJobs)
				.where(eq(PrintJobs.status, "pending"))
				.orderBy(asc(PrintJobs.createdAt))
				.limit(1);

			if (foundJob.length === 0) {
				return null;
			}

			const jobToClaim = foundJob[0];

			await tx.update(PrintJobs).set({ status: "claimed", claimedAt: new Date() }).where(eq(PrintJobs.id, jobToClaim.id));

			return jobToClaim;
		});

		if (!job) {
			return res.status(204).send();
		}

		const custodianUser = aliasedTable(Users, "custodian");

		const propertyDataResult = await db
			.select({
				serialNo: Properties.serialNo,
				propertyNo: Properties.propertyNo,
				description: Properties.description,
				acquisitionDate: PropertyDetails.acquisitionDate,
				assignedCustodian: custodianUser.name,
				modelNo: PropertyDetails.modelNo,
			})
			.from(Properties)
			.where(eq(Properties.id, job.propertyId))
			.leftJoin(PropertyDetails, eq(Properties.id, PropertyDetails.propertyId))
			.leftJoin(CustodianAssignments, eq(Properties.id, CustodianAssignments.propertyId))
			.leftJoin(custodianUser, eq(CustodianAssignments.custodianId, custodianUser.id))
			.limit(1);

		if (propertyDataResult.length === 0) {
			return res.status(404).json({ message: "Property for the claimed job not found." });
		}

		// Send the customized JSON object to the ESP32
		res.status(200).json(propertyDataResult[0]);
	} catch (error) {
		console.error("Error fetching next print job:", error);
		res.status(500).json({ message: "Server error while fetching print job." });
	}
};

/**
 * @desc    Get a list of all print jobs
 * @route   GET /api/print-jobs
 * @access  Private (Admin, Master Admin)
 */
export const getAllPrintJobs = async (req, res) => {
	try {
		// Create an alias for the Users table to specifically get the custodian's name
		const custodianUser = aliasedTable(Users, "custodian");

		// Fetch all jobs, joining with all necessary tables
		const allJobs = await db
			.select({
				jobId: PrintJobs.id,
				status: PrintJobs.status,
				propertyNo: Properties.propertyNo,
				propertyDescription: Properties.description,
				requestedByName: Users.name, // Name of the user who requested the print
				jobCreatedAt: PrintJobs.createdAt,
				jobClaimedAt: PrintJobs.claimedAt,
				// --- NEWLY ADDED FIELDS ---
				acquisitionDate: PropertyDetails.acquisitionDate,
				assignedCustodian: custodianUser.name, // Name of the custodian assigned to the property
			})
			.from(PrintJobs)
			.leftJoin(Properties, eq(PrintJobs.propertyId, Properties.id))
			.leftJoin(Users, eq(PrintJobs.requestedBy, Users.id)) // Join for the requester
			.leftJoin(PropertyDetails, eq(PrintJobs.propertyId, PropertyDetails.propertyId)) // Join to get details
			.leftJoin(CustodianAssignments, eq(PrintJobs.propertyId, CustodianAssignments.propertyId)) // Join to find the custodian assignment
			.leftJoin(custodianUser, eq(CustodianAssignments.custodianId, custodianUser.id)) // Join to get the custodian's name
			.orderBy(desc(PrintJobs.createdAt)); // Order by most recent first

		res.status(200).json(allJobs);
	} catch (error) {
		console.error("Error fetching all print jobs:", error);
		res.status(500).json({ message: "Failed to fetch print jobs." });
	}
};
