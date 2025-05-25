import { Router } from "express";
import {
	addProperty,
	assignOrReassignProperty, // Consider renaming this to assignOrReassignProperty
	deleteProperty,
	getAllProperties,
	getAssignedProperties,
	getProperty,
	getPropertyByScanner,
	updateProperty,
	getPrintableQr,
} from "../controllers/properties.controller.js";
import authorize from "../middleware/auth.middleware.js";
import checkRole from "../middleware/checkRole.middleware.js";

const propertiesRouter = Router();

// All routes below require the user to be authenticated.
propertiesRouter.use(authorize);

// =================================================================
// 1. MOST SPECIFIC ROUTES (Keywords first)
// =================================================================

// GET all properties (base route)
// Roles are checked inside the controller to return appropriate data
propertiesRouter.get("/", getAllProperties);

// POST a new property
propertiesRouter.post("/add", checkRole(["admin", "master_admin"]), addProperty);

// POST an assignment
// I've renamed assignOrReassignProperty to assignOrReassignProperty in the controller for clarity
propertiesRouter.post("/assign", checkRole(["admin", "master_admin", "property_custodian"]), assignOrReassignProperty);

// GET assigned properties for a specific user.
// This single route replaces the separate /custodian and /staff routes.
// The controller can handle the logic based on who is making the request.
propertiesRouter.get(
	"/assigned/:userId",
	checkRole(["admin", "master_admin", "property_custodian", "staff"]),
	getAssignedProperties
);

// =================================================================
// 2. PARAMETERIZED ROUTES (More general routes last)
// =================================================================

// GET a single property by its ID.
// This MUST be defined after the keyword routes above.
propertiesRouter.get("/:id", checkRole(["admin", "master_admin", "property_custodian"]), getProperty);

// GET a printable QR code for a specific property
propertiesRouter.get(
	"/:id/printable-qr",
	checkRole(["admin", "master_admin", "property_custodian", "staff"]),
	getPrintableQr
);

// UPDATE a property
propertiesRouter.patch("/update/:id", checkRole(["admin", "master_admin"]), updateProperty);

// DELETE a property
propertiesRouter.delete("/:id", checkRole(["admin", "master_admin"]), deleteProperty);

// Special route for scanner - consider namespacing it more, e.g., /scan/property/:id
// But keeping it as is for now. Placed here as it's highly specific.
propertiesRouter.get("/scan/:id", getPropertyByScanner); // Assuming scanner has its own auth method outside of standard user roles

export default propertiesRouter;
