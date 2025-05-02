import { storage } from "../lib/appwrite.js";
import { APPWRITE_BUCKET_ID } from "../config/env.js";

export async function deleteQrCode(qrId) {
	try {
		console.log("Deleting QR Code with ID: ", qrId);
		await storage.deleteFile(APPWRITE_BUCKET_ID ?? "", qrId);
	} catch (error) {
		console.error("Error deleting QR Code: ", error);
		throw new Error("Failed to delete QR Code.");
	}
}
