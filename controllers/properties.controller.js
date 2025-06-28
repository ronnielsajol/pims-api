import { aliasedTable, and, eq, getTableColumns, sql } from "drizzle-orm";
import { db } from "../database/supabase.js";
import { Properties } from "../models/properties.model.js";
import { Users } from "../models/users.model.js";
import { SCANNER_SECRET_KEY } from "../config/env.js";
import { CustodianAssignments } from "../models/custodian-assignments.model.js";
import { ReassignmentRequests } from "../models/reassignment-requests.model.js";
import { StaffAssignments } from "../models/staff-assignments.model.js";
import { PropertyDetails } from "../models/property-details.model.js";
import { fileURLToPath } from "url";
import path from "path";
import puppeteer from "puppeteer";
import ejs from "ejs";

export const getAllProperties = async (req, res, next) => {
	try {
		const user = req.user;

		// --- Pagination Logic ---
		// Get page and pageSize from query params, with sane defaults.
		const page = parseInt(req.query.page) || 1;
		const pageSize = parseInt(req.query.pageSize) || 10;
		const offset = (page - 1) * pageSize;

		let propertiesQuery;
		let countQuery;

		// --- Role-Based Query Building ---
		if (user.role === "master_admin" || user.role === "admin") {
			const custodianUser = aliasedTable(Users, "custodian");
			propertiesQuery = db
				.select({
					...getTableColumns(Properties),
					assignedTo: custodianUser.name,
					assignedDepartment: CustodianAssignments.assigned_department,
					reassignmentStatus: ReassignmentRequests.status,
					totalValue: sql`CAST(properties.quantity AS numeric) * CAST(properties.value AS numeric)`,
				})
				.from(Properties)
				.leftJoin(CustodianAssignments, eq(Properties.id, CustodianAssignments.propertyId))
				.leftJoin(custodianUser, eq(CustodianAssignments.custodianId, custodianUser.id))
				.leftJoin(
					ReassignmentRequests,
					and(eq(Properties.id, ReassignmentRequests.propertyId), eq(ReassignmentRequests.status, "pending"))
				)
				.orderBy(Properties.id)
				.limit(pageSize)
				.offset(offset);

			countQuery = db.select({ count: sql`count(*)::int` }).from(Properties);
		} else if (user.role === "property_custodian") {
			const custodianUser = aliasedTable(Users, "custodian");
			const staffUser = aliasedTable(Users, "staff");
			propertiesQuery = db
				.select({
					...getTableColumns(Properties),
					assignedTo: sql`COALESCE(${staffUser.name}, ${custodianUser.name})`,
					assignedDepartment: CustodianAssignments.assigned_department,
					reassignmentStatus: ReassignmentRequests.status,
				})
				.from(CustodianAssignments)
				.where(eq(CustodianAssignments.custodianId, user.id))
				.innerJoin(Properties, eq(CustodianAssignments.propertyId, Properties.id))
				.innerJoin(custodianUser, eq(CustodianAssignments.custodianId, custodianUser.id))
				.leftJoin(StaffAssignments, eq(CustodianAssignments.propertyId, StaffAssignments.propertyId))
				.leftJoin(staffUser, eq(StaffAssignments.staffId, staffUser.id))
				.leftJoin(
					ReassignmentRequests,
					and(eq(Properties.id, ReassignmentRequests.propertyId), eq(ReassignmentRequests.status, "pending"))
				)
				.orderBy(Properties.id)
				.limit(pageSize)
				.offset(offset);

			countQuery = db
				.select({ count: sql`count(*)::int` })
				.from(CustodianAssignments)
				.where(eq(CustodianAssignments.custodianId, user.id));
		} else if (user.role === "staff") {
			propertiesQuery = db
				.select({ ...getTableColumns(Properties) })
				.from(StaffAssignments)
				.where(eq(StaffAssignments.staffId, user.id))
				.innerJoin(Properties, eq(StaffAssignments.propertyId, Properties.id))
				.orderBy(Properties.id)
				.limit(pageSize)
				.offset(offset);

			countQuery = db
				.select({ count: sql`count(*)::int` })
				.from(StaffAssignments)
				.where(eq(StaffAssignments.staffId, user.id));
		} else {
			return res.status(403).json({ success: false, message: "Forbidden" });
		}

		// Execute both queries in parallel for efficiency
		const [properties, totalCountResult] = await Promise.all([propertiesQuery, countQuery]);

		const totalCount = totalCountResult[0].count;
		const pageCount = Math.ceil(totalCount / pageSize);

		return res.status(200).json({
			success: true,
			data: properties,
			meta: {
				page,
				pageSize,
				pageCount,
				totalCount,
			},
		});
	} catch (error) {
		next(error);
	}
};

export const addProperty = async (req, res, next) => {
	try {
		const { property } = req.body;

		if (!property?.propertyNo || !property?.description || !property?.quantity || !property?.value || !property?.serialNo) {
			const error = new Error("Missing required fields");
			error.status = 400;
			throw error;
		}

		const newPropertyWithDetails = await db.transaction(async (tx) => {
			// 1. Insert into the main Properties table
			const [newProperty] = await tx
				.insert(Properties)
				.values({
					propertyNo: property.propertyNo,
					description: property.description,
					quantity: property.quantity,
					value: property.value,
					serialNo: property.serialNo || null,
					location_detail: property.location_detail || null,
				})
				.returning();

			// 2. Insert the corresponding (initially empty) details row
			// Note: We use the ID from the property we just created.
			await tx.insert(PropertyDetails).values({
				propertyId: newProperty.id,
				// All other fields will default to NULL (or "" if you prefer, but NULL is better for non-string types)
			});

			// 3. Return the main property object
			return newProperty;
		});

		res.status(201).json({
			success: true,
			message: "Property and its details record added successfully",
			data: { property: newPropertyWithDetails },
		});
	} catch (error) {
		if (error.code === "23505") {
			let duplicateField = "An unknown field";
			console.log(error);
			if (error.constraint_name === "properties_property_no_unique") {
				duplicateField = "Property Number";
			} else if (error.constraint_name === "properties_serial_no_unique") {
				duplicateField = "Serial Number";
			}

			return res.status(409).json({
				success: false,
				message: `A property with this ${duplicateField} already exists.`,
			});
		}

		next(error);
	}
};

export const updateProperty = async (req, res, next) => {
	try {
		const { id } = req.params;
		const { property } = req.body;

		if (!id || !property) {
			throw new Error("Missing ID or property data");
		}

		const required = ["propertyNo", "description", "quantity", "value", "serialNo"];
		for (const key of required) {
			if (!property[key]) {
				throw new Error(`Missing field: ${key}`);
			}
		}

		const [existing] = await db
			.select()
			.from(Properties)
			.where(eq(Properties.id, Number(id)));
		if (!existing) {
			return res.status(404).json({ success: false, message: "Property not found" });
		}

		await db
			.update(Properties)
			.set({
				propertyNo: property.propertyNo,
				description: property.description,
				quantity: property.quantity,
				value: property.value,
				serialNo: property.serialNo,
				updatedAt: new Date(),
				category: property.category || "Annex A", // Default to "Annex A" if not provided
			})
			.where(eq(Properties.id, Number(id)));

		const [updated] = await db
			.select()
			.from(Properties)
			.where(eq(Properties.id, Number(id)));

		return res.status(200).json({
			success: true,
			message: "Property updated successfully",
			data: { property: updated },
		});
	} catch (error) {
		if (error.code === "23505") {
			let duplicateField = "An unknown field";
			console.log(error);
			if (error.constraint_name === "properties_property_no_unique") {
				duplicateField = "Property Number";
			} else if (error.constraint_name === "properties_serial_no_unique") {
				duplicateField = "Serial Number";
			}

			return res.status(409).json({
				success: false,
				message: `A property with this ${duplicateField} already exists.`,
			});
		}

		next(error);
	}
};

export const getPropertyWithDetails = async (req, res, next) => {
	try {
		const propertyId = parseInt(req.params.id, 10);
		if (isNaN(propertyId)) {
			return res.status(400).json({ success: false, message: "Invalid Property ID." });
		}

		const custodianUser = aliasedTable(Users, "custodian");
		const staffUser = aliasedTable(Users, "staff");

		// Fetch both the main property and its details in one go
		const [result] = await db
			.select({
				property: getTableColumns(Properties),
				details: getTableColumns(PropertyDetails),
				assignedTo: sql`COALESCE(${staffUser.name}, ${custodianUser.name})`,
				assignedDepartment: CustodianAssignments.assigned_department,
				totalValue: sql`CAST(properties.quantity AS numeric) * CAST(properties.value AS numeric)`,
			})
			.from(Properties)
			.where(eq(Properties.id, propertyId))
			.leftJoin(PropertyDetails, eq(Properties.id, PropertyDetails.propertyId))
			.leftJoin(CustodianAssignments, eq(Properties.id, CustodianAssignments.propertyId))
			.leftJoin(custodianUser, eq(CustodianAssignments.custodianId, custodianUser.id))
			.leftJoin(StaffAssignments, eq(Properties.id, StaffAssignments.propertyId))
			.leftJoin(staffUser, eq(StaffAssignments.staffId, staffUser.id));

		if (!result) {
			return res.status(404).json({ success: false, message: "Property not found." });
		}

		const combinedData = {
			...result.property,
			details: result.details || null,
			assignedTo: result.assignedTo || null,
			assignedDepartment: result.assignedDepartment || null,
			totalValue: result.totalValue,
		};

		return res.status(200).json({ success: true, data: combinedData });
	} catch (error) {
		next(error);
	}
};

export const updatePropertyDetails = async (req, res, next) => {
	try {
		const propertyId = parseInt(req.params.id, 10);
		if (isNaN(propertyId)) {
			return res.status(400).json({ success: false, message: "Invalid Property ID." });
		}

		const { details } = req.body; // Expecting a 'details' object in the body
		if (!details || typeof details !== "object" || Object.keys(details).length === 0) {
			return res.status(400).json({ success: false, message: "Details object is required." });
		}

		// Prepare fields to update, only including those provided in the request
		const updateValues = {
			updatedAt: new Date(), // Always update this timestamp
		};

		// List of allowed fields to prevent malicious data injection
		const allowedFields = [
			"article",
			"oldPropertyNo",
			"unitOfMeasure",
			"acquisitionDate",
			"condition",
			"remarks",
			"pupBranch",
			"assetType",
			"fundCluster",
			"poNo",
			"invoiceDate",
			"invoiceNo",
			"duration",
		];

		for (const field of allowedFields) {
			if (details[field] !== undefined) {
				// For date fields, ensure they are valid dates or null
				if (
					["acquisitionDate", "invoiceDate"].includes(field) &&
					details[field] !== null &&
					!new Date(details[field]).getTime()
				) {
					continue; // Skip invalid date values
				}
				updateValues[field] = details[field];
			}
		}

		const [updatedDetails] = await db
			.update(PropertyDetails)
			.set(updateValues)
			.where(eq(PropertyDetails.propertyId, propertyId))
			.returning();

		if (!updatedDetails) {
			return res.status(404).json({ success: false, message: "Property details not found for this ID." });
		}

		return res.status(200).json({
			success: true,
			message: "Property details updated successfully.",
			data: updatedDetails,
		});
	} catch (error) {
		next(error);
	}
};

export const assignOrReassignProperty = async (req, res, next) => {
	try {
		const assigner = req.user;
		const { propertyId, userId: assigneeId } = req.body;

		// --- ADMIN/MASTER ADMIN LOGIC ---
		if (assigner.role === "master_admin" || assigner.role === "admin") {
			const [assignee] = await db.select().from(Users).where(eq(Users.id, assigneeId));
			if (assignee?.role !== "property_custodian") {
				return res.status(400).json({ success: false, message: "Admins can only assign properties to Property Custodians." });
			}

			if (!assignee.department) {
				return res.status(400).json({
					success: false,
					message: `Custodian '${assignee.name}' does not have a department assigned. Please assign a department to the custodian first.`,
				});
			}
			const [newAssignment] = await db
				.insert(CustodianAssignments)
				.values({ propertyId, custodianId: assigneeId, assignedBy: assigner.id, assigned_department: assignee.department })
				.onConflictDoUpdate({
					target: CustodianAssignments.propertyId,
					set: {
						custodianId: assigneeId,
						assignedBy: assigner.id,
						assigned_department: assignee.department,
						assignedAt: new Date(),
					},
				})
				.returning();
			await db.delete(StaffAssignments).where(eq(StaffAssignments.propertyId, propertyId));
			return res
				.status(200)
				.json({ success: true, message: "Property assigned to custodian successfully.", data: newAssignment });
		}

		// --- PROPERTY CUSTODIAN LOGIC (Separate from Admin) ---
		if (assigner.role === "property_custodian") {
			const [assignee] = await db.select().from(Users).where(eq(Users.id, assigneeId));
			if (assignee?.role !== "staff") {
				return res.status(400).json({ success: false, message: "Custodians can only delegate properties to Staff." });
			}
			const [isOwner] = await db
				.select()
				.from(CustodianAssignments)
				.where(and(eq(CustodianAssignments.propertyId, propertyId), eq(CustodianAssignments.custodianId, assigner.id)));
			if (!isOwner) {
				return res
					.status(403)
					.json({ success: false, message: "Forbidden: You are not the primary custodian for this property." });
			}
			const [existingStaffAssignment] = await db
				.select()
				.from(StaffAssignments)
				.where(eq(StaffAssignments.propertyId, propertyId));

			if (!existingStaffAssignment) {
				// First-time assignment to staff
				const [newDelegation] = await db
					.insert(StaffAssignments)
					.values({ propertyId, staffId: assigneeId, assignedByCustodianId: assigner.id })
					.returning();
				return res
					.status(201)
					.json({ success: true, message: "Property assigned to staff successfully.", data: newDelegation });
			} else {
				// Re-assignment, which requires approval
				const [pendingRequestExists] = await db
					.select()
					.from(ReassignmentRequests)
					.where(and(eq(ReassignmentRequests.propertyId, propertyId), eq(ReassignmentRequests.status, "pending")));
				if (pendingRequestExists) {
					return res.status(409).json({ success: false, message: "This property already has a pending reassignment request." });
				}
				const [newRequest] = await db
					.insert(ReassignmentRequests)
					.values({
						propertyId,
						fromStaffId: existingStaffAssignment.staffId,
						toStaffId: assigneeId,
						requestedByCustodianId: assigner.id,
						status: "pending",
					})
					.returning();
				return res.status(202).json({
					success: true,
					message: "Re-assignment request submitted. It is now pending approval from a Master Admin.",
					data: newRequest,
				});
			}
		}

		return res.status(403).json({ success: false, message: "Forbidden: Your role cannot assign properties." });
	} catch (error) {
		next(error);
	}
};

export const getPendingReassignments = async (req, res, next) => {
	try {
		// We join all tables to get a descriptive response
		const fromStaff = aliasedTable(Users, "fromStaff");
		const toStaff = aliasedTable(Users, "toStaff");
		const custodian = aliasedTable(Users, "custodian");

		const requests = await db
			.select({
				requestId: ReassignmentRequests.id,
				property: getTableColumns(Properties),
				fromStaff: getTableColumns(fromStaff),
				toStaff: getTableColumns(toStaff),
				requestedBy: getTableColumns(custodian),
				status: ReassignmentRequests.status,
				createdAt: ReassignmentRequests.createdAt,
			})
			.from(ReassignmentRequests)
			.where(eq(ReassignmentRequests.status, "pending"))
			.innerJoin(Properties, eq(ReassignmentRequests.propertyId, Properties.id))
			.innerJoin(fromStaff, eq(ReassignmentRequests.fromStaffId, fromStaff.id))
			.innerJoin(toStaff, eq(ReassignmentRequests.toStaffId, toStaff.id))
			.innerJoin(custodian, eq(ReassignmentRequests.requestedByCustodianId, custodian.id));

		res.status(200).json({ success: true, data: requests });
	} catch (error) {
		next(error);
	}
};

// 2. Controller to approve or deny a request
export const reviewReassignmentRequest = async (req, res, next) => {
	const { requestId, newStatus } = req.body; // newStatus should be 'approved' or 'denied'
	const masterAdminId = req.user.id;

	if (!requestId || !["approved", "denied"].includes(newStatus)) {
		return res
			.status(400)
			.json({ success: false, message: "Request ID and a valid status ('approved' or 'denied') are required." });
	}

	try {
		const result = await db.transaction(async (tx) => {
			// Find the request and lock it for update
			const [request] = await tx
				.select()
				.from(ReassignmentRequests)
				.where(eq(ReassignmentRequests.id, requestId))
				.for("update");

			if (!request) {
				tx.rollback();
				return res.status(404).json({ success: false, message: "Request not found." });
			}
			if (request.status !== "pending") {
				tx.rollback();
				return res.status(409).json({ success: false, message: "This request has already been reviewed." });
			}

			// If approved, update the actual staff assignment
			if (newStatus === "approved") {
				await tx
					.update(StaffAssignments)
					.set({ staffId: request.toStaffId })
					.where(eq(StaffAssignments.propertyId, request.propertyId));
			}

			// Update the request itself to mark it as reviewed
			const [updatedRequest] = await tx
				.update(ReassignmentRequests)
				.set({
					status: newStatus,
					reviewedByMasterAdminId: masterAdminId,
					reviewedAt: new Date(),
				})
				.where(eq(ReassignmentRequests.id, requestId))
				.returning();

			return res.status(200).json({ success: true, message: `Request has been ${newStatus}.`, data: updatedRequest });
		});
		return result;
	} catch (error) {
		next(error);
	}
};

export const getAssignedProperties = async (req, res, next) => {
	try {
		const userId = parseInt(req.params.userId, 10);
		if (isNaN(userId)) {
			return res.status(400).json({ success: false, message: "Invalid User ID provided." });
		}

		// 1. Find the user to determine their role
		const [user] = await db.select({ role: Users.role }).from(Users).where(eq(Users.id, userId));
		if (!user) {
			return res.status(404).json({ success: false, message: "User not found." });
		}

		let assignedProperties = [];

		// 2. Query the correct table based on the user's role
		if (user.role === "property_custodian") {
			assignedProperties = await db
				.select({
					id: Properties.id,
					propertyNo: Properties.propertyNo,
					description: Properties.description,
				})
				.from(CustodianAssignments)
				.innerJoin(Properties, eq(CustodianAssignments.propertyId, Properties.id))
				.where(eq(CustodianAssignments.custodianId, userId));
		} else if (user.role === "staff") {
			assignedProperties = await db
				.select({
					id: Properties.id,
					propertyNo: Properties.propertyNo,
					description: Properties.description,
				})
				.from(StaffAssignments)
				.innerJoin(Properties, eq(StaffAssignments.propertyId, Properties.id))
				.where(eq(StaffAssignments.staffId, userId));
		}

		return res.status(200).json({
			success: true,
			message: "Assigned properties fetched successfully",
			data: assignedProperties,
		});
	} catch (error) {
		next(error);
	}
};

export const deleteProperty = async (req, res, next) => {
	try {
		const propertyId = parseInt(req.params.id, 10);
		if (isNaN(propertyId)) {
			return res.status(400).json({ success: false, message: "Invalid Property ID." });
		}

		const { confirmed } = req.body;

		const [existingProperty] = await db.select().from(Properties).where(eq(Properties.id, propertyId));
		if (!existingProperty) {
			return res.status(404).json({ success: false, message: "Property not found" });
		}

		// 1. Check for primary assignments in the new table
		const [existingAssignment] = await db
			.select()
			.from(CustodianAssignments)
			.where(eq(CustodianAssignments.propertyId, propertyId));

		if (existingAssignment && !confirmed) {
			return res.status(200).json({
				success: false,
				message: "This property is assigned to a custodian. Are you sure you want to delete it?",
				requiresConfirmation: true,
			});
		}

		// 3. Delete the property itself. The cascade will clean up the rest.
		await db.delete(Properties).where(eq(Properties.id, propertyId));

		return res.status(200).json({
			success: true,
			message: "Property and all its assignments deleted successfully",
			data: { propertyId: propertyId },
		});
	} catch (error) {
		next(error);
	}
};
export const getPropertyByScanner = async (req, res) => {
	const { id } = req.params;
	const scannerKey = req.headers["x-scanner-key"];

	if (scannerKey !== SCANNER_SECRET_KEY) {
		return res.status(401).json({ success: false, message: "Unauthorized scanner" });
	}

	const [property] = await db
		.select({
			id: Properties.id,
			propertyNo: Properties.propertyNo,
			description: Properties.description,
		})
		.from(Properties)
		.where(eq(Properties.id, Number(id)));

	if (!property) {
		return res.status(404).json({ success: false, message: "Property not found" });
	}

	return res.status(200).json({
		success: true,
		data: property,
	});
};

export const getProperty = async (req, res) => {
	const { id } = req.params;

	if (!id) {
		return res.status(400).json({ error: "Missing id" });
	}

	const [property] = await db
		.select({
			id: Properties.id,
			propertyNo: Properties.propertyNo,
			description: Properties.description,
			quantity: Properties.quantity,
			value: Properties.value,
			serialNo: Properties.serialNo,
		})
		.from(Properties)
		.where(eq(Properties.id, Number(id)));

	if (!property) {
		return res.status(404).json({ success: false, message: "Property not found" });
	}

	return res.status(200).json({
		success: true,
		data: property,
	});
};

export const updatePropertyLocationDetail = async (req, res, next) => {
	try {
		const propertyId = parseInt(req.params.propertyId, 10);
		if (isNaN(propertyId)) {
			return res.status(400).json({ success: false, message: "Invalid Property ID." });
		}

		const { property } = req.body;
		const location_detail = property?.location_detail;
		if (typeof location_detail !== "string" || location_detail.trim() === "") {
			// Basic validation
			return res.status(400).json({ success: false, message: "Location detail is required." });
		}

		const custodian = req.user; // Logged-in user

		// Authorization: Ensure this custodian is assigned this property
		const [assignment] = await db
			.select()
			.from(CustodianAssignments)
			.where(and(eq(CustodianAssignments.propertyId, propertyId), eq(CustodianAssignments.custodianId, custodian.id)));

		if (!assignment) {
			return res
				.status(403)
				.json({ success: false, message: "Forbidden: You are not assigned this property or it does not exist." });
		}

		// Update the property's location detail
		const [updatedProperty] = await db
			.update(Properties)
			.set({ location_detail: location_detail.trim(), updatedAt: new Date() })
			.where(eq(Properties.id, propertyId))
			.returning();

		if (!updatedProperty) {
			return res.status(404).json({ success: false, message: "Property not found for update." });
		}

		return res.status(200).json({
			success: true,
			message: "Property location detail updated successfully.",
			data: updatedProperty,
		});
	} catch (error) {
		next(error);
	}
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const generateReport = async (req, res) => {
	const user = req.user;

	if (!["master_admin", "admin", "property_custodian"].includes(user.role)) {
		return res.status(403).json({ message: "Forbidden: You do not have permission to generate this report." });
	}

	if (user.role === "property_custodian" && !user.id) {
		return res.status(400).json({ message: "User ID is required for property custodian reports." });
	}

	let browser;
	try {
		// --- Data Fetching ---
		const custodian = aliasedTable(Users, "custodian");
		const staff = aliasedTable(Users, "staff");
		let reportDataQuery = db
			.select({
				propertyNo: Properties.propertyNo,
				description: Properties.description,
				quantity: Properties.quantity,
				value: Properties.value,
				serialNo: Properties.serialNo,
				locationDetail: Properties.location_detail,
				article: PropertyDetails.article,
				oldPropertyNo: PropertyDetails.oldPropertyNo,
				unitOfMeasure: PropertyDetails.unitOfMeasure,
				acquisitionDate: PropertyDetails.acquisitionDate,
				condition: PropertyDetails.condition,
				remarks: PropertyDetails.remarks,
				pupBranch: PropertyDetails.pupBranch,
				assetType: PropertyDetails.assetType,
				fundCluster: PropertyDetails.fundCluster,
				poNo: PropertyDetails.poNo,
				invoiceDate: PropertyDetails.invoiceDate,
				invoiceNo: PropertyDetails.invoiceNo,
				totalValue:
					sql`CASE WHEN ${Properties.quantity} IS NOT NULL AND ${Properties.value} IS NOT NULL THEN CAST(${Properties.quantity} AS numeric) * CAST(${Properties.value} AS numeric) ELSE 0 END`.as(
						"totalValue"
					),
				custodianName: custodian.name,
				assignedDepartment: CustodianAssignments.assigned_department,
				staffName: staff.name,
			})
			.from(Properties)
			.leftJoin(PropertyDetails, eq(Properties.id, PropertyDetails.propertyId))
			.leftJoin(CustodianAssignments, eq(Properties.id, CustodianAssignments.propertyId))
			.leftJoin(custodian, eq(CustodianAssignments.custodianId, custodian.id))
			.leftJoin(StaffAssignments, eq(Properties.id, StaffAssignments.propertyId))
			.leftJoin(staff, eq(StaffAssignments.staffId, staff.id));

		if (user.role === "property_custodian") {
			reportDataQuery = reportDataQuery.where(eq(CustodianAssignments.custodianId, user.id));
		}
		const reportData = await reportDataQuery;

		if (reportData.length === 0) {
			return res.status(404).json({ message: "No properties found to generate a report." });
		}

		// --- PDF Generation with Puppeteer ---
		const templatePath = path.join(__dirname, "../templates/report-template.ejs");
		const html = await ejs.renderFile(templatePath, { reportData, user });

		const puppeteerOptions = {
			headless: "new",
			args: [
				"--no-sandbox",
				"--disable-setuid-sandbox", //comment these arguments if you are running on a local machine starting from here
				"--disable-dev-shm-usage",
				"--disable-accelerated-2d-canvas",
				"--no-first-run",
				"--no-zygote",
				"--single-process",
				"--disable-gpu",
				"--disable-web-security",
				"--disable-features=VizDisplayCompositor", // End of arguments to comment out if running locally
			],
		};

		console.log("Launching Puppeteer with options:", puppeteerOptions);
		browser = await puppeteer.launch(puppeteerOptions);

		const page = await browser.newPage();

		await page.setViewport({ width: 1920, height: 1080 });

		await page.setContent(html, { waitUntil: "load", timeout: 30000 });

		const pdfBuffer = await page.pdf({
			format: "A3",
			landscape: true,
			printBackground: true,
			margin: { top: "20px", right: "30px", bottom: "20px", left: "30px" },
			timeout: 30000,
		});

		const filename = `PIMS_Inventory_Report_${new Date().toISOString().slice(0, 10)}.pdf`;

		res.writeHead(200, {
			"Content-Type": "application/pdf",
			"Content-Disposition": `attachment; filename="${filename}"`,
			"Content-Length": pdfBuffer.length,
		});
		res.end(pdfBuffer);
	} catch (error) {
		console.error("Error generating PDF report with Puppeteer:", error);

		if (!res.headersSent) {
			res.status(500).json({ message: "Failed to generate report due to a server error." });
		}
	} finally {
		if (browser) {
			try {
				await browser.close();
			} catch (closeError) {
				console.error("Error closing browser:", closeError);
			}
		}
	}
};

export const previewReportTemplate = async (req, res) => {
	try {
		// Create a mock user object for the template header
		const mockUser = {
			role: "property_custodian",
			department: "Sample Department Preview",
		};

		// Create a few rows of mock data to populate the table
		const mockReportData = [
			{
				article: "Laptop",
				description: "Dell XPS 15",
				propertyNo: "2025-001",
				oldPropertyNo: "N/A",
				unitOfMeasure: "unit",
				quantity: "1",
				value: "150000.00",
				totalValue: "150000.00",
				acquisitionDate: new Date(),
				condition: "Good",
				serialNo: "ABC123XYZ",
				remarks: "For development",
				assignedDepartment: "ICTO",
				locationDetail: "Workspace A",
				custodianName: "Ronniel Custodian",
				staffName: "Sample Staff",
				pupBranch: "Main",
				assetType: "ICT Equipment",
				fundCluster: "101",
				poNo: "PO-987",
				invoiceDate: new Date(),
				invoiceNo: "INV-654",
			},
			{
				article: "Monitor",
				description: "LG 27-inch 4K",
				propertyNo: "2025-002",
				// other fields can be null to test blank cells
			},
		];

		// Define the path to your EJS template
		const templatePath = path.join(__dirname, "../templates/report-template.ejs");

		// Render the template with the mock data
		const html = await ejs.renderFile(templatePath, {
			reportData: mockReportData,
			user: mockUser,
		});

		// Send the response as HTML
		res.setHeader("Content-Type", "text/html");
		res.send(html);
	} catch (error) {
		console.error("Error generating report preview:", error);
		res.status(500).json({ message: "Failed to generate preview." });
	}
};
