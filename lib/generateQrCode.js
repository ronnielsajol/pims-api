import QRCode from "qrcode";
import { storage } from "../lib/appwrite.js";
import { APPWRITE_BUCKET_ID } from "../config/env.js";
import { ID } from "appwrite";

export async function generateQrCode(userId) {
	try {
		const qrDataUrl = await QRCode.toDataURL(String(userId), {
			width: 500,
			scale: 10,
		});

		const base64Data = qrDataUrl.split(";base64,")[1];
		const qrBuffer = Buffer.from(base64Data, "base64");
		const qrBlob = new Blob([qrBuffer], { type: "image/png" });

		const sanitizeUserId = String(userId).replace(/[^a-zA-Z0-9-_]/g, "_");
		const fileName = `qrcode_${sanitizeUserId}.png`;

		const qrFile = new File([qrBlob], fileName, { type: "image/png" });

		const response = await storage.createFile(APPWRITE_BUCKET_ID ?? "", ID.unique(), qrFile);

		const qrCodeUrl = storage.getFileView(APPWRITE_BUCKET_ID ?? "", response.$id);

		return qrCodeUrl;
	} catch (error) {
		console.error("Error generating QR Code: ", error);
		throw new Error("Failed to generate QR Code.");
	}
}
