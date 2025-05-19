import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const Properties = pgTable("properties", {
	id: serial("id").primaryKey(),

	propertyNo: text("property_no").notNull(),
	description: text("description").notNull(),
	quantity: text("quantity"),
	value: text("value"),
	serialNo: text("serial_no"),
	accountablePerson: text("accountable_person"),
	location: text("location"),

	qrCode: text("qr_code"),
	qrId: text("qr_id"),

	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow(),
});
