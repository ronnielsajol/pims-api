import { Router } from "express";

import authorize from "../middleware/auth.middleware.js";
import checkRole from "../middleware/checkRole.middleware.js";
import { getUserById, getUsers } from "../controllers/user.controller.js";

const userRouter = Router();

// GET routes
userRouter.get("/", authorize, checkRole(["property_custodian", "admin", "master_admin"]), getUsers);
userRouter.get("/:id", authorize, checkRole(["admin", "master_admin"]), getUserById);
export default userRouter;
