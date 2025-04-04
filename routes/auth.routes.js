import { Router } from "express";
import { signIn, signOut, signUp, adminSignUp } from "../controllers/auth.controller.js";
import authorize from "../middleware/auth.middleware.js";
import checkRole from "../middleware/checkRole.middleware.js";

const authRouter = Router();

authRouter.post("/sign-up", signUp);
authRouter.post("/sign-in", signIn);
authRouter.post("/sign-out", signOut);

//admin sign up
authRouter.post("/admin/sign-up", authorize, checkRole(["master_admin"]), adminSignUp);

export default authRouter;
