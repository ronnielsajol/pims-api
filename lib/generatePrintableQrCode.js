import { Jimp } from "jimp";
// import { intToRGBA } from "@jimp/utils";
import axios from "axios";

/**
 * Downloads an image from a URL and converts it to a thermal printer-friendly format.
 * @param {string} imageUrl - The public URL of the QR code image.
 * @returns {Promise<object>} An object with width, height, and a comma-separated data string.
 */
export async function generatePrintableQrFromUrl(imageUrl) {
	if (!imageUrl) {
		throw new Error("Image URL cannot be empty.");
	}

	try {
		// --- Step 1: Download the image from the URL ---
		const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
		const imageBuffer = Buffer.from(response.data, "binary");
		console.log(imageBuffer);

		// --- Step 2: Process the downloaded buffer with Jimp ---
		const image = await Jimp.fromBuffer(imageBuffer);

		// Resize the image to a printer-friendly width (e.g., 128px)
		image.resize({ w: 64, h: Jimp.AUTO });

		// Process for printing
		image.dither().greyscale().contrast(1).invert();

		// const width = image.bitmap.width;
		// const height = image.bitmap.height;
		// const printableData = [];

		const processedImageBuffer = await image.getBuffer("image/jpeg");
		// --- Step 3: Convert to printer byte array ---
		// for (let y = 0; y < height; y++) {
		// 	for (let x = 0; x < width; x += 8) {
		// 		let byte = 0;
		// 		for (let b = 0; b < 8; b++) {
		// 			if (intToRGBA(image.getPixelColor(x + b, y)).r > 128) {
		// 				byte |= 1 << (7 - b);
		// 			}
		// 		}
		// 		printableData.push(byte);
		// 	}
		// }

		// --- Step 4: Return the final data object ---
		return processedImageBuffer;
	} catch (error) {
		// We now re-throw the original error to get a more specific message
		console.error(`Error processing QR from URL: `, error);
		throw new Error("Failed to process QR code from URL. " + error.message);
	}
}
