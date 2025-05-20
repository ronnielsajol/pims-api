import { eq } from "drizzle-orm";
import { db } from "../database/supabase.js";
import { generateQrCode } from "../lib/generateQrCode.js";
import { Properties } from "../models/properties.model.js";
import { Users } from "../models/users.model.js";
import { Accountable } from "../models/accountable.model.js";
import { deleteQrCode } from "../lib/deleteQrCode.js";
import { SCANNER_SECRET_KEY } from "../config/env.js";

export const getAllProperties = async (req, res, next) => {
	try {
		const includeAssignments = req.query.includeAssignments === "true";

		let baseQuery = db
			.select({
				id: Properties.id,
				propertyNo: Properties.propertyNo,
				description: Properties.description,
				quantity: Properties.quantity,
				value: Properties.value,
				serialNo: Properties.serialNo,
				qrCode: Properties.qrCode,
			})
			.from(Properties);

		if (includeAssignments) {
			baseQuery = db
				.select({
					id: Properties.id,
					propertyNo: Properties.propertyNo,
					description: Properties.description,
					quantity: Properties.quantity,
					value: Properties.value,
					serialNo: Properties.serialNo,
					qrCode: Properties.qrCode,
					assignedTo: Users.name,
				})
				.from(Properties)
				.leftJoin(Accountable, eq(Properties.id, Accountable.propertyId))
				.leftJoin(Users, eq(Accountable.userId, Users.id));
		}

		const properties = await baseQuery;
		res.status(200).json({ success: true, data: properties });
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

		if (!property?.propertyNo || !property?.description || !property?.quantity || !property?.value || !property?.serialNo) {
			const error = new Error("Missing fields");
			error.status = 400;
			throw error;
		}

		if (!id) {
			const error = new Error("Missing id");
			error.status = 400;
			throw error;
		}

		const [existingProperty] = await db
			.select()
			.from(Properties)
			.where(eq(Properties.id, Number(id)));

		if (!existingProperty) {
			const error = new Error("Property not found");
			error.status = 404;
			throw error;
		}

		const updateFields = {};
		if (name !== undefined) updateFields.name = name;
		if (description !== undefined) updateFields.description = description;

		await db
			.update(Properties)
			.set(updateFields)
			.where(eq(Properties.id, Number(id)));

		const [updatedProperty] = await db
			.select({
				id: Properties.id,
				name: Properties.name,
				description: Properties.description,
			})
			.from(Properties)
			.where(eq(Properties.id, Number(id)));
		return res
			.status(200)
			.json({ success: true, message: "Property updated successfully", data: { property: updatedProperty } });
	} catch (error) {
		console.error("Error updating property:", error);
		next(error);
	}
};

export const assignOrReassignPropertyToStaff = async (req, res) => {
	try {
		const { userId, propertyId } = req.body;

		if (!userId || !propertyId) {
			return res.status(400).json({ error: "Missing fields" });
		}

		const [user] = await db.select().from(Users).where(eq(Users.id, userId));
		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		const [property] = await db.select().from(Properties).where(eq(Properties.id, propertyId));
		if (!property) {
			return res.status(404).json({ error: "Property not found" });
		}

		const [existingAssignment] = await db.select().from(Accountable).where(eq(Accountable.propertyId, propertyId));

		if (existingAssignment) {
			// If assigned to the same user, no need to reassign
			if (existingAssignment.userId === userId) {
				return res.status(400).json({ error: "Property already assigned to this user" });
			}

			// Reassign: update the record with new userId
			const updated = await db.update(Accountable).set({ userId }).where(eq(Accountable.propertyId, propertyId)).returning();

			return res.status(200).json({
				success: true,
				message: "Property reassigned successfully",
				data: { assignment: updated[0] },
			});
		}

		// No assignment yet, insert new
		const [newAssignment] = await db.insert(Accountable).values({ userId, propertyId }).returning();

		if (!newAssignment) {
			return res.status(500).json({ error: "Failed to assign property" });
		}

		return res.status(201).json({
			success: true,
			message: "Property assigned successfully",
			data: { assignment: newAssignment },
		});
	} catch (error) {
		console.error("Error assigning or reassigning property:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};
export const getAssignedProperties = async (req, res) => {
	try {
		const { userId } = req.params;

		if (!userId) {
			return res.status(400).json({ error: "Missing userId" });
		}

		const assignedProperties = await db
			.select({
				id: Properties.id,
				name: Properties.name,
				description: Properties.description,
				qrCode: Properties.qrCode,
			})
			.from(Accountable)
			.innerJoin(Properties, eq(Accountable.propertyId, Properties.id))
			.where(eq(Accountable.userId, Number(userId)));

		return res.status(200).json({
			success: true,
			message: "Assigned properties fetched successfully",
			data: assignedProperties,
		});
	} catch (error) {
		console.error("Error getting assigned properties:", error);
		res.status(500).json({ error: error.message });
	}
};

export const deleteProperty = async (req, res) => {
	try {
		const { id } = req.params;
		const { confirmed } = req.body;
		if (!id) {
			const error = new Error("Missing id");
			error.status = 400;
			throw error;
		}

		const [existingProperty] = await db
			.select()
			.from(Properties)
			.where(eq(Properties.id, Number(id)));
		if (!existingProperty) {
			return res.status(404).json({ error: "Property not found" });
		}

		// Fetch assignments for the property
		const existingAssignments = await db
			.select()
			.from(Accountable)
			.where(eq(Accountable.propertyId, Number(id)));

		// If there are existing assignments and confirmation is not provided
		if (existingAssignments.length > 0 && !confirmed) {
			return res.status(200).json({
				error: "Property is assigned to users. Please confirm deletion.",
				message: "Are you sure you want to delete this property?",
				requiresConfirmation: true,
			});
		}

		// Delete all the assignments associated with this property
		await db.delete(Accountable).where(eq(Accountable.propertyId, Number(id)));

		// Now delete the property itself
		await deleteQrCode(existingProperty.qrId);
		await db.delete(Properties).where(eq(Properties.id, Number(id)));

		return res.status(200).json({
			success: true,
			message: "Property deleted successfully",
			data: { propertyId: id },
		});
	} catch (error) {
		console.error("Error deleting property:", error);
		res.status(500).json({ error: error.message });
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
			name: Properties.name,
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
			name: Properties.name,
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
