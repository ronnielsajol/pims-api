import { aliasedTable, and, eq, getTableColumns, sql } from "drizzle-orm";
import { db } from "../database/supabase.js";
import { Properties } from "../models/properties.model.js";
import { Users } from "../models/users.model.js";
import { SCANNER_SECRET_KEY } from "../config/env.js";
import { generatePrintableQrFromUrl } from "../lib/generatePrintableQrCode.js";
import { CustodianAssignments } from "../models/custodian-assignments.model.js";
import { ReassignmentRequests } from "../models/reassignment-requests.model.js";
import { StaffAssignments } from "../models/staff-assignments.model.js";

export const getAllProperties = async (req, res, next) => {
	try {
		const user = req.user;

		// --- ADMIN VIEW  ---
		// Shows the property and the CUSTODIAN it is assigned to.
		if (user.role === "master_admin" || user.role === "admin") {
			// 1. Correctly define the alias for the Users table BEFORE the query
			const custodianUser = aliasedTable(Users, "custodian");

			const properties = await db
				.select({
					// Select all columns from the Properties table
					...getTableColumns(Properties),
					// 2. Use the alias to select the custodian's name
					assignedTo: custodianUser.name,
					assignedDepartment: CustodianAssignments.assigned_department,
					reassignmentStatus: ReassignmentRequests.status,
				})
				.from(Properties)
				.leftJoin(CustodianAssignments, eq(Properties.id, CustodianAssignments.propertyId))
				// 3. Use the alias in the join condition
				.leftJoin(custodianUser, eq(CustodianAssignments.custodianId, custodianUser.id))
				.leftJoin(
					ReassignmentRequests,
					and(eq(Properties.id, ReassignmentRequests.propertyId), eq(ReassignmentRequests.status, "pending"))
				)
				.orderBy(Properties.id);

			return res.status(200).json({ success: true, data: properties });
		}

		// --- CUSTODIAN VIEW ---
		if (user.role === "property_custodian") {
			const custodianUser = aliasedTable(Users, "custodian");
			const staffUser = aliasedTable(Users, "staff");

			const properties = await db
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
				);

			return res.status(200).json({ success: true, data: properties });
		}

		if (user.role === "staff") {
			const properties = await db
				.select({
					...getTableColumns(Properties),
				})
				.from(StaffAssignments)
				.where(eq(StaffAssignments.staffId, user.id))
				.innerJoin(Properties, eq(StaffAssignments.propertyId, Properties.id));
			return res.status(200).json({ success: true, data: properties });
		}

		return res.status(403).json({ success: false, message: "Forbidden" });
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

		const [newProperty] = await db
			.insert(Properties)
			.values({
				propertyNo: property.propertyNo,
				description: property.description,
				quantity: property.quantity,
				value: property.value,
				serialNo: property.serialNo,
			})
			.returning();

		// 3. Return a success response with the newly created property data
		res.status(201).json({
			success: true,
			message: "Property added successfully",
			data: { property: newProperty },
		});
	} catch (error) {
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

export const getPrintableQr = async (req, res, next) => {
	try {
		const { id } = req.params;

		if (!id) {
			const error = new Error("Property ID is required.");
			error.status = 400;
			throw error;
		}

		// 1. Fetch the property from the database
		const [property] = await db
			.select({
				qrCode: Properties.qrCode,
			})
			.from(Properties)
			.where(eq(Properties.id, Number(id)));

		if (!property) {
			const error = new Error("Property not found.");
			error.status = 404;
			throw error;
		}

		if (!property.qrCode || !property.qrCode.startsWith("http")) {
			const error = new Error("A valid QR code URL does not exist for this property.");
			error.status = 404;
			throw error;
		}

		// 2. Pass the URL to the helper function to get printable data
		const printableData = await generatePrintableQrFromUrl(property.qrCode);

		// 3. Return the printable data
		res.status(200).json({ success: true, data: printableData });
	} catch (error) {
		next(error); // Pass errors to your middleware
	}
};

export const updatePropertyLocationDetail = async (req, res, next) => {
	try {
		const propertyId = parseInt(req.params.propertyId, 10);
		if (isNaN(propertyId)) {
			return res.status(400).json({ success: false, message: "Invalid Property ID." });
		}

		const { location_detail } = req.body;
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
