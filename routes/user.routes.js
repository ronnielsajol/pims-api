import { Router } from "express";

import authorize from "../middleware/auth.middleware.js";
import { getUserById, getUsers } from "../controllers/user.controller.js";

const userRouter = Router();

userRouter.get("/", authorize, getUsers);
userRouter.get("/:id", authorize, getUserById);

export default userRouter;
