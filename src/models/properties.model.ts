import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const Properties = pgTable("properties", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	description: text("description"),
	qrCode: text("qr_code"), // Stores QR code data (URL or Base64)
	qrId: text("qr_id"), // Stores the ID of the QR code in Appwrite
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow(),
});
