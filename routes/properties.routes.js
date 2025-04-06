import { Router } from "express";
import { addProperty, getAllProperties } from "../controllers/properties.controller.js";
import authorize from "../middleware/auth.middleware.js";
import checkRole from "../middleware/checkRole.middleware.js";

const propertiesRouter = Router();

propertiesRouter.get("/all", authorize, checkRole(["admin", "master_admin"]), getAllProperties);
propertiesRouter.post("/add", authorize, checkRole(["admin", "master_admin"]), addProperty);

export default propertiesRouter;
