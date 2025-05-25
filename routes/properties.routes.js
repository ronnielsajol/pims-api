import { Router } from "express";
import {
	addProperty,
	assignOrReassignPropertyToStaff,
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

propertiesRouter.get("/all", authorize, checkRole(["property_custodian", "admin", "master_admin"]), getAllProperties);
propertiesRouter.post("/add", authorize, checkRole(["admin", "master_admin"]), addProperty);
propertiesRouter.post("/assign", authorize, checkRole(["admin", "master_admin"]), assignOrReassignPropertyToStaff);
propertiesRouter.patch("/update/:id", authorize, checkRole(["admin", "master_admin"]), updateProperty);
propertiesRouter.delete("/:id", authorize, checkRole(["admin", "master_admin"]), deleteProperty);

propertiesRouter.get("/:id", authorize, checkRole(["admin", "master_admin"]), getProperty);

propertiesRouter.get(
	"/:id/printable-qr",
	authorize,
	checkRole(["admin", "master_admin", "property_custodian", "staff"]), // Or whichever roles should be able to print
	getPrintableQr
);

propertiesRouter.get("/scan/:id", authorize, checkRole(["admin", "master_admin"]), getPropertyByScanner);
propertiesRouter.get(
	"/custodian/:userId",
	authorize,
	checkRole(["property_custodian", "admin", "master_admin"]),
	getAssignedProperties
);
propertiesRouter.get("/staff/:userId", authorize, checkRole(["staff", "admin", "master_admin"]), getAssignedProperties);

export default propertiesRouter;
