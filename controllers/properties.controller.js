import { and, eq } from "drizzle-orm";
import { db } from "../database/supabase.js";
import { generateQrCode } from "../lib/generateQrCode.js";
import { Properties } from "../models/properties.model.js";
import { Users } from "../models/users.model.js";
import { Accountable } from "../models/accountable.model.js";

export const getAllProperties = async (req, res, next) => {
	try {
		const properties = await db
			.select({
				id: Properties.id,
				name: Properties.name,
				description: Properties.description,
				qrCode: Properties.qrCode,
			})
			.from(Properties);

		res.status(200).json({ success: true, data: properties });
	} catch (error) {
		next(error);
	}
};
export const addProperty = async (req, res, next) => {
	try {
		const { name, description } = req.body;

		if (!name || !description) {
			const error = new Error("Missing fields");
			error.status = 400;
			throw error;
		}

		const [newProperty] = await db.insert(Properties).values({ name, description }).returning();

		let qrCode;
		try {
			qrCode = await generateQrCode(newProperty.id);
		} catch (error) {
			console.error("QR Code generation failed:", error);
			return res.json({ error: "Failed to generate QR code" }, { status: 500 });
		}

		const [updateQr] = await db
			.update(Properties)
			.set({ qrCode: qrCode })
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
		const { name, description } = req.body;

		if (!name && !description) {
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

export const assignPropertyToStaff = async (req, res) => {
	try {
		const { userId, propertyId } = req.body;

		if (!userId || !propertyId) {
			const error = new Error("Missing fields");
			error.status = 400;
			throw error;
		}

		const [user] = await db.select().from(Users).where(eq(Users.id, userId));
		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		const [property] = await db.select().from(Properties).where(eq(Properties.id, propertyId));
		if (!property) {
			return res.status(404).json({ error: "Property not found" });
		}

		const [existingAssignment] = await db
			.select()
			.from(Accountable)
			.where(and(eq(Accountable.userId, userId), eq(Accountable.propertyId, propertyId)));
		if (existingAssignment) {
			return res.status(400).json({ error: "Property already assigned to this user" });
		}

		const [assigned] = await db.insert(Accountable).values({ userId, propertyId }).returning();

		if (!assigned) {
			return res.status(500).json({ error: "Failed to assign property" });
		}

		return res.status(201).json({
			success: true,
			messsage: "Property assigned successfully",
			data: { assignment: assigned },
		});
	} catch (error) {
		console.error("Error assigning property to staff:", error);
		res.status(500).json({ error: "Internal server error" });
	}
};

export const getAssignedProperties = async (req, res) => {
	try {
		const { userId } = req.params;

		if (!userId) {
			return res.status(400).json({ error: "Missing userId" });
		}

		// Fetch all properties assigned to the user via join
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

		if (assignedProperties.length === 0) {
			return res.status(404).json({ error: "No properties assigned to this user" });
		}

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
