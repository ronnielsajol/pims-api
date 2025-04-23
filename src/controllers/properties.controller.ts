import { Request, Response, NextFunction } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../database/supabase";
import { generateQrCode } from "../lib/generateQrCode";
import { Properties } from "../models/properties.model";
import { Users } from "../models/users.model";
import { Accountable } from "../models/accountable.model";
import { deleteQrCode } from "../lib/deleteQrCode";
import { env } from "../config/env";

interface CreatePropertyRequest extends Request {
	body: {
		name: string;
		description: string;
	};
}

interface AssignRequest extends Request {
	body: {
		userId: number;
		propertyId: number;
	};
}

interface DeleteRequest extends Request {
	params: { id: string };
	body: { confirmed?: boolean };
}

interface ScannerRequest extends Request {
	params: { id: string };
	headers: { "x-scanner-key"?: string };
}

export const getAllProperties = async (_req: Request, res: Response, next: NextFunction) => {
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
export const addProperty = async (req: CreatePropertyRequest, res: Response, next: NextFunction) => {
	try {
		const { name, description } = req.body;
		if (!name || !description) {
			return res.status(400).json({ message: "Missing fields" });
		}

		const [newProperty] = await db.insert(Properties).values({ name, description }).returning();

		let qrCode;
		try {
			qrCode = await generateQrCode(newProperty.id);
			if (!qrCode || !qrCode.url) {
				return res.status(500).json({ message: "QR code generation failed" });
			}
		} catch (error) {
			console.error("QR Code generation failed:", error);
			if (error instanceof Error) {
				return res.status(500).json({ message: "Failed to generate QR code", error: error.message });
			}
			return res.status(500).json({ error: error });
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

export const updateProperty = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { id } = req.params;
		const { name, description } = req.body;

		if (!name && !description) {
			return res.status(400).json({ message: "Missing fields" });
		}

		const [existingProperty] = await db
			.select()
			.from(Properties)
			.where(eq(Properties.id, Number(id)));

		if (!existingProperty) {
			return res.status(404).json({ message: "Property not found" });
		}

		const updateFields: Record<string, any> = {};
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

export const assignPropertyToStaff = async (req: AssignRequest, res: Response) => {
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

export const getAssignedProperties = async (req: Request, res: Response) => {
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
		if (error instanceof Error) {
			return res.status(500).json({ error: error.message });
		}
		return res.status(500).json({ error: error });
	}
};

export const deleteProperty = async (req: DeleteRequest, res: Response) => {
	try {
		const { id } = req.params;
		const { confirmed } = req.body;

		if (!id) return res.status(400).json({ error: "Missing id" });

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
			return res.status(400).json({
				error: "Property is assigned to users. Please confirm deletion.",
				message: "Are you sure you want to delete this property?",
				requiresConfirmation: true,
			});
		}

		// Delete all the assignments associated with this property
		await db.delete(Accountable).where(eq(Accountable.propertyId, Number(id)));

		// Now delete the property itself
		await deleteQrCode(existingProperty.qrId as string); // Delete the QR code from Appwrite storage
		await db.delete(Properties).where(eq(Properties.id, Number(id)));

		return res.status(200).json({
			success: true,
			message: "Property deleted successfully",
			data: { propertyId: id },
		});
	} catch (error) {
		console.error("Error deleting property:", error);
		if (error instanceof Error) {
			return res.status(500).json({ error: error.message });
		}
		return res.status(500).json({ error: error });
	}
};

export const getPropertyByScanner = async (req: ScannerRequest, res: Response) => {
	const { id } = req.params;
	const scannerKey = req.headers["x-scanner-key"];

	if (scannerKey !== env.SCANNER_SECRET_KEY) {
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
