import { aliasedTable, and, eq, getTableColumns, sql } from "drizzle-orm";
import { db } from "../database/supabase.js";
import { generateQrCode } from "../lib/generateQrCode.js";
import { Properties } from "../models/properties.model.js";
import { Users } from "../models/users.model.js";
import { deleteQrCode } from "../lib/deleteQrCode.js";
import { SCANNER_SECRET_KEY } from "../config/env.js";
import { generatePrintableQrFromUrl } from "../lib/generatePrintableQrCode.js";
import { CustodianAssignments } from "../models/custodian-assignments.model.js";
import { StaffAssignments } from "../models/staff-assignments.model.js";

export const getAllProperties = async (req, res, next) => {
	try {
		const user = req.user;

		// --- ADMIN VIEW (CORRECTED) ---
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
				})
				.from(Properties)
				.leftJoin(CustodianAssignments, eq(Properties.id, CustodianAssignments.propertyId))
				// 3. Use the alias in the join condition
				.leftJoin(custodianUser, eq(CustodianAssignments.custodianId, custodianUser.id))
				.orderBy(Properties.id);

			return res.status(200).json({ success: true, data: properties });
		}

		// --- CUSTODIAN VIEW (No changes, was already correct) ---
		if (user.role === "property_custodian") {
			const custodianUser = aliasedTable(Users, "custodian");
			const staffUser = aliasedTable(Users, "staff");

			const properties = await db
				.select({
					...getTableColumns(Properties),
					assignedTo: sql`COALESCE(${staffUser.name}, ${custodianUser.name})`,
				})
				.from(CustodianAssignments)
				.where(eq(CustodianAssignments.custodianId, user.id))
				.innerJoin(Properties, eq(CustodianAssignments.propertyId, Properties.id))
				.innerJoin(custodianUser, eq(CustodianAssignments.custodianId, custodianUser.id))
				.leftJoin(StaffAssignments, eq(CustodianAssignments.propertyId, StaffAssignments.propertyId))
				.leftJoin(staffUser, eq(StaffAssignments.staffId, staffUser.id));

			return res.status(200).json({ success: true, data: properties });
		}

		// --- STAFF VIEW (No changes, was already correct) ---
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
			const error = new Error("Missing fields");
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

		let qrCode;
		try {
			qrCode = await generateQrCode(newProperty.id);
			if (!qrCode || !qrCode.url) {
				return res.status(500).json({ message: "QR code generation failed" });
			}
		} catch (error) {
			console.error("QR Code generation failed:", error);
			return res.status(500).json({ message: "Failed to generate QR code", error: error.message });
		}

		const [updateQr] = await db
			.update(Properties)
			.set({ qrCode: qrCode.url, qrId: qrCode.id })
			.where(eq(Properties.id, newProperty.id))
			.returning();

		res.status(201).json({
			success: true,
			message: "Property added successfully",
			data: { property: updateQr },
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

		// --- ADMIN/MASTER ADMIN ASSIGNING TO CUSTODIAN ---
		if (assigner.role === "master_admin" || assigner.role === "admin") {
			const [assignee] = await db.select().from(Users).where(eq(Users.id, assigneeId));
			if (assignee?.role !== "property_custodian") {
				return res.status(400).json({ success: false, message: "Admins can only assign properties to Property Custodians." });
			}

			// Upsert logic: insert a new assignment or update the existing one
			const [newAssignment] = await db
				.insert(CustodianAssignments)
				.values({
					propertyId,
					custodianId: assigneeId,
					assignedBy: assigner.id,
				})
				.onConflictDoUpdate({
					target: CustodianAssignments.propertyId,
					set: { custodianId: assigneeId, assignedBy: assigner.id, assignedAt: new Date() },
				})
				.returning();

			// If we re-assign to a new custodian, we must clear any old staff delegations
			await db.delete(StaffAssignments).where(eq(StaffAssignments.propertyId, propertyId));

			return res
				.status(200)
				.json({ success: true, message: "Property assigned to custodian successfully.", data: newAssignment });
		}

		// --- PROPERTY CUSTODIAN DELEGATING TO STAFF ---
		if (assigner.role === "property_custodian") {
			const [assignee] = await db.select().from(Users).where(eq(Users.id, assigneeId));
			if (assignee?.role !== "staff") {
				return res.status(400).json({ success: false, message: "Custodians can only delegate properties to Staff." });
			}

			// Security check: Ensure this property is actually assigned to the custodian trying to delegate it
			const [isOwner] = await db
				.select()
				.from(CustodianAssignments)
				.where(and(eq(CustodianAssignments.propertyId, propertyId), eq(CustodianAssignments.custodianId, assigner.id)));
			if (!isOwner) {
				return res
					.status(403)
					.json({ success: false, message: "Forbidden: You are not the primary custodian for this property." });
			}

			// Upsert logic for delegation
			const [newDelegation] = await db
				.insert(StaffAssignments)
				.values({
					propertyId,
					staffId: assigneeId,
					assignedByCustodianId: assigner.id,
				})
				.onConflictDoUpdate({
					target: StaffAssignments.propertyId,
					set: { staffId: assigneeId, assignedAt: new Date() },
				})
				.returning();

			return res
				.status(200)
				.json({ success: true, message: "Property delegated to staff successfully.", data: newDelegation });
		}

		return res.status(403).json({ success: false, message: "Forbidden: Your role cannot assign properties." });
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
					qrCode: Properties.qrCode,
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
					qrCode: Properties.qrCode,
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

		// 2. No need to manually delete assignments. The database's "ON DELETE CASCADE" handles it.

		// Delete the associated QR Code
		if (existingProperty.qrId) {
			await deleteQrCode(existingProperty.qrId);
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
			qrCode: Properties.qrCode,
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
