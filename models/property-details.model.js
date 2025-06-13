import { pgTable, integer, text, varchar, date, timestamp } from "drizzle-orm/pg-core";
import { Properties } from "./properties.model.js";

export const PropertyDetails = pgTable("property_details", {
	// This column is both the Primary Key and the Foreign Key, creating a one-to-one link.
	propertyId: integer("property_id")
		.primaryKey()
		.references(() => Properties.id, { onDelete: "cascade" }),

	// Your new columns - using text/varchar for flexibility and date for date fields
	article: text("article"), // "Article/Item"
	oldPropertyNo: varchar("old_property_no", { length: 255 }),
	unitOfMeasure: varchar("unit_of_measure", { length: 100 }),
	acquisitionDate: date("acquisition_date"),
	condition: text("condition"),
	remarks: text("remarks"),
	pupBranch: text("pup_branch"), // Assuming PUP Branch is a text field
	assetType: text("asset_type"), // "Type of Asset"
	fundCluster: varchar("fund_cluster", { length: 255 }),
	poNo: varchar("po_no", { length: 255 }), // "PO. Number"
	invoiceDate: date("invoice_date"),
	invoiceNo: varchar("invoice_no", { length: 255 }),

	// Timestamps for tracking changes to these details
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
