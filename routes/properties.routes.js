import { Router } from "express";
import { addProperty, getAllProperties } from "../controllers/properties.controller";

const propertiesRouter = Router();

propertiesRouter.get("/all", getAllProperties);
propertiesRouter.post("/add", addProperty);

export default propertiesRouter;
