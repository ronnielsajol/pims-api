import { Router } from "express";

import authorize from "../middleware/auth.middleware.js";
import checkRole from "../middleware/checkRole.middleware.js";
import { deleteUser, getUserById, getUsers, updateUser } from "../controllers/user.controller.js";

const userRouter = Router();

// This middleware will protect all routes in this file
userRouter.use(authorize);

userRouter.get("/", checkRole(["property_custodian", "admin", "master_admin"]), getUsers);

userRouter
	.route("/:id")
	.get(checkRole(["admin", "master_admin"]), getUserById)
	.patch(checkRole(["master_admin", "admin"]), updateUser)
	.delete(checkRole(["master_admin"]), deleteUser);

export default userRouter;
