import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const properties = pgTable("properties", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	description: text("description"),
	qrCode: text("qr_code"), // Stores QR code data (URL or Base64)
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow(),
});
