import { eq } from "drizzle-orm";
import { db } from "../database/supabase.js";
import { generateQrCode } from "../lib/generateQrCode.js";
import { Properties } from "../models/properties.model.js";

export const getAllProperties = async (req, res, next) => {
	try {
		const properties = await db
			.select({
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
