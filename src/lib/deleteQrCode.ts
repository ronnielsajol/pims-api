import { storage } from "./appwrite.js";
import { env } from "../config/env.js";

export async function deleteQrCode(qrId: string) {
	try {
		await storage.deleteFile(env.APPWRITE_BUCKET_ID ?? "", qrId);
	} catch (error) {
		console.error("Error deleting QR Code: ", error);
		throw new Error("Failed to delete QR Code.");
	}
}
