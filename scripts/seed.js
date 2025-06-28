import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { db } from "../database/supabase.js";

// --- Adjust these import paths to match your project structure ---
import { Users } from "../models/users.model.js";
import { Properties } from "../models/properties.model.js";
import { PropertyDetails } from "../models/property-details.model.js";
import { CustodianAssignments } from "../models/custodian-assignments.model.js";
import { StaffAssignments } from "../models/staff-assignments.model.js";
import { ReassignmentRequests } from "../models/reassignment-requests.model.js";

async function main() {
	console.log("Starting database seeding process...");

	console.log("-> Clearing existing data...");
	await db.delete(ReassignmentRequests).execute();
	await db.delete(StaffAssignments).execute();
	await db.delete(CustodianAssignments).execute();
	await db.delete(PropertyDetails).execute();
	await db.delete(Properties).execute();
	await db.delete(Users).execute();
	console.log("   Data cleared successfully.");

	console.log("-> Seeding users...");
	const hashedPassword = await bcrypt.hash("12301230", 10);

	// Create Master Admin
	const [masterAdmin] = await db
		.insert(Users)
		.values({
			name: "Master Admin",
			email: "master_admin@test.com",
			password: hashedPassword,
			role: "master_admin",
			department: "PSMO", // <-- UPDATED
		})
		.returning();

	const adminUsers = [];
	for (let i = 0; i < 3; i++) {
		const [admin] = await db
			.insert(Users)
			.values({
				name: `Admin User ${i + 1}`,
				email: `admin_${i + 1}@test.com`,
				password: hashedPassword,
				role: "admin",
				department: "PSMO", // <-- UPDATED
			})
			.returning();
		adminUsers.push(admin);
	}

	const departments = ["ICTO", "HRM", "Accounting", "Library", "Clinic"];
	const custodians = [];
	for (let i = 0; i < departments.length; i++) {
		const [custodian] = await db
			.insert(Users)
			.values({
				name: faker.person.fullName(),
				email: `custodian_${i + 1}@test.com`,
				password: hashedPassword,
				role: "property_custodian",
				department: departments[i],
			})
			.returning();
		custodians.push(custodian);
	}

	const staffUsers = [];
	for (let i = 0; i < 15; i++) {
		const [staff] = await db
			.insert(Users)
			.values({
				name: faker.person.fullName(),
				email: `staff_${i + 1}@test.com`,
				password: hashedPassword,
				role: "staff",
				department: faker.helpers.arrayElement(departments), // Assign to a random existing department
			})
			.returning();
		staffUsers.push(staff);
	}
	console.log(`   Seeded ${1 + adminUsers.length + custodians.length + staffUsers.length} users.`);

	console.log("-> Seeding properties and assignments...");
	const categories = ["Annex A", "Annex B", "Annex C"];
	const properties = [];
	const primaryAdmin = adminUsers[0];

	const techProducts = [
		{ brand: "Dell", item: "OptiPlex 7010 Desktop" },
		{ brand: "Logitech", item: "MX Master 3S Mouse" },
		{ brand: "Keychron", item: "K2 Mechanical Keyboard" },
		{ brand: "LG", item: '27" 4K Monitor' },
		{ brand: "Apple", item: 'MacBook Pro 16"' },
		{ brand: "HP", item: "LaserJet Pro MFP Printer" },
		{ brand: "Cisco", item: "Catalyst 2960 Switch" },
		{ brand: "Ubiquiti", item: "UniFi Access Point" },
		{ brand: "Anker", item: "USB-C Hub" },
		{ brand: "Raspberry Pi", item: "Model 4 B" },
		{ brand: "Arduino", item: "Uno R3 Microcontroller" },
		{ brand: "Synology", item: "DS923+ NAS Server" },
		{ brand: "Herman Miller", item: "Ergonomic Office Chair" },
		{ brand: "VariDesk", item: "Standing Desk Converter" },
		{ brand: "Wacom", item: "Intuos Pro Tablet" },
		{ brand: "Samsung", item: "Portable SSD T7" },
		{ brand: "Microsoft", item: "Surface Laptop 5" },
		{ brand: "Corsair", item: "RM850x Power Supply" },
		{ brand: "NZXT", item: "H510 ATX Mid Tower Case" },
		{ brand: "ASUS", item: "ROG Strix Gaming Laptop" },
		{ brand: "TP-Link", item: "Archer AX6000 Router" },
		{ brand: "Seagate", item: "IronWolf 8TB NAS HDD" },
		{ brand: "Western Digital", item: "Black SN850 NVMe SSD" },
		{ brand: "Intel", item: "Core i9-13900K Processor" },
		{ brand: "AMD", item: "Ryzen 9 7900X CPU" },
		{ brand: "NVIDIA", item: "GeForce RTX 4080 GPU" },
		{ brand: "BenQ", item: 'PD3200U 32" Monitor' },
		{ brand: "Jabra", item: "Evolve2 65 Headset" },
		{ brand: "Bose", item: "QuietComfort 45 Headphones" },
		{ brand: "Elgato", item: "Stream Deck XL" },
		{ brand: "AverMedia", item: "Live Gamer Portable 2 Plus" },
		{ brand: "Sandisk", item: "Extreme PRO SDXC Card" },
		{ brand: "Canon", item: "EOS R50 Mirrorless Camera" },
		{ brand: "Sony", item: "WH-1000XM5 Wireless Headphones" },
		{ brand: "Razer", item: "DeathAdder V3 Pro Mouse" },
		{ brand: "SteelSeries", item: "Apex Pro TKL Keyboard" },
		{ brand: "Cooler Master", item: "Hyper 212 CPU Cooler" },
		{ brand: "Beats", item: "Studio Buds+" },
		{ brand: "Tile", item: "Mate Bluetooth Tracker" },
		{ brand: "Lenovo", item: "ThinkPad X1 Carbon" },
		{ brand: "Fitbit", item: "Charge 6 Fitness Tracker" },
		{ brand: "DJI", item: "Mini 4 Pro Drone" },
		{ brand: "GoPro", item: "HERO12 Black Action Camera" },
		{ brand: "Acer", item: "Predator XB273 Monitor" },
		{ brand: "Alienware", item: "Aurora R15 Gaming Desktop" },
		{ brand: "NETGEAR", item: "Nighthawk Mesh WiFi 6 System" },
		{ brand: "Shure", item: "MV7 USB Podcast Microphone" },
		{ brand: "Blue", item: "Yeti X Microphone" },
		{ brand: "Zoom", item: "H6 Handy Audio Recorder" },
		{ brand: "Epson", item: "EcoTank ET-2850 Printer" },
	];

	for (let i = 0; i < 50; i++) {
		const selectedProduct = faker.helpers.arrayElement(techProducts);

		const [property] = await db
			.insert(Properties)
			.values({
				propertyNo: `PUP-2025-${faker.string.numeric(4)}`,
				description: selectedProduct.brand,
				quantity: faker.helpers.arrayElement(["1", "2", "5", "10"]),
				value: faker.commerce.price({ min: 5000, max: 50000 }),
				serialNo: `PUP-TWS-${faker.string.numeric(4)}`,
				location_detail: faker.helpers.arrayElement(["Main Office", "Conference Room", "Pantry", "Storage Closet"]),
				category: faker.helpers.arrayElement(categories),
			})
			.returning();
		properties.push(property);

		await db.insert(PropertyDetails).values({
			propertyId: property.id,
			article: selectedProduct.item,
			unitOfMeasure: "unit",
			acquisitionDate: faker.date.past({ years: 5 }).toISOString().slice(0, 10),
			condition: faker.helpers.arrayElement(["Good", "Needs Repair", "Fair"]),
			remarks: "Initial stock",
			pupBranch: "Main Campus",
		});

		// Assign property to a random custodian
		const randomCustodian = faker.helpers.arrayElement(custodians);
		await db.insert(CustodianAssignments).values({
			propertyId: property.id,
			custodianId: randomCustodian.id,
			assignedBy: primaryAdmin.id,
			assigned_department: randomCustodian.department,
		});
	}
	console.log(`   Seeded ${properties.length} properties.`);

	console.log("-> Seeding staff assignments...");
	for (let i = 0; i < 25; i++) {
		const property = properties[i];
		const custodianAssignment = await db
			.select()
			.from(CustodianAssignments)
			.where(eq(CustodianAssignments.propertyId, property.id))
			.limit(1);

		if (custodianAssignment) {
			const custodianDept = custodians.find((c) => c.id === custodianAssignment.custodianId)?.department;
			const availableStaff = staffUsers.filter((s) => s.department === custodianDept);

			if (availableStaff.length > 0) {
				const randomStaff = faker.helpers.arrayElement(availableStaff);
				await db.insert(StaffAssignments).values({
					propertyId: property.id,
					staffId: randomStaff.id,
					assignedByCustodianId: custodianAssignment.custodianId,
				});
			}
		}
	}
	console.log("   Staff assignments seeded.");

	console.log("Database seeding complete!");
	process.exit(0);
}

main().catch((err) => {
	console.error("An error occurred during database seeding:", err);
	process.exit(1);
});
