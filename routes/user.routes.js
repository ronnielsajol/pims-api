import { Router } from "express";

import authorize from "../middleware/auth.middleware.js";
import checkRole from "../middleware/checkRole.middleware.js";
import { getAdmins, getAllUsers, getUserById, getUsers } from "../controllers/user.controller.js";

const userRouter = Router();

// GET routes
userRouter.get("/all", authorize, checkRole(["admin", "master_admin"]), getAllUsers);
userRouter.get("/staff", authorize, checkRole(["admin", "master_admin"]), getUsers);
userRouter.get("/admin", authorize, checkRole(["master_admin"]), getAdmins);
userRouter.get("/:id", authorize, checkRole(["admin", "master_admin"]), getUserById);
export default userRouter;
