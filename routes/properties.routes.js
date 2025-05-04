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
} from "../controllers/properties.controller.js";
import authorize from "../middleware/auth.middleware.js";
import checkRole from "../middleware/checkRole.middleware.js";

const propertiesRouter = Router();

propertiesRouter.get("/all", authorize, checkRole(["admin", "master_admin"]), getAllProperties);
propertiesRouter.post("/add", authorize, checkRole(["admin", "master_admin"]), addProperty);
propertiesRouter.post("/assign", authorize, checkRole(["admin", "master_admin"]), assignOrReassignPropertyToStaff);
propertiesRouter.patch("/update/:id", authorize, checkRole(["admin", "master_admin"]), updateProperty);
propertiesRouter.delete("/:id", authorize, checkRole(["admin", "master_admin"]), deleteProperty);

propertiesRouter.get("/:id", authorize, checkRole(["admin", "master_admin"]), getProperty);
propertiesRouter.get("/scan/:id", authorize, checkRole(["admin", "master_admin"]), getPropertyByScanner);
propertiesRouter.get("/staff/:userId", authorize, checkRole(["staff", "admin", "master_admin"]), getAssignedProperties);

export default propertiesRouter;
