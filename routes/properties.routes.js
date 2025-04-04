import { Router } from "express";
import { addProperty, getAllProperties } from "../controllers/properties.controller.js";
import authorize from "../middleware/auth.middleware.js";

const propertiesRouter = Router();

propertiesRouter.get("/all", authorize, getAllProperties);
propertiesRouter.post("/add", authorize, addProperty);

export default propertiesRouter;
