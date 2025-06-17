import { pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const categoryEnum = pgEnum("category", ["Annex A", "Annex B", "Annex C"]);

export const Properties = pgTable("properties", {
	id: serial("id").primaryKey(),

	propertyNo: text("property_no").notNull(),
	description: text("description").notNull(),
	quantity: text("quantity"),
	value: text("value"),
	serialNo: text("serial_no"),
	location_detail: text("location_detail"),
	category: categoryEnum("category").default("Annex A").notNull(),

	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow(),
});
