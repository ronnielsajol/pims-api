import { Router } from "express";
import { signIn, signOut, signUp } from "../controllers/auth.controller.js";
import { authorizeOptional } from "../middleware/authorizeOptional.middleware.js";

const authRouter = Router();

authRouter.post("/sign-up", authorizeOptional, signUp);
authRouter.post("/sign-in", signIn);
authRouter.post("/sign-out", signOut);

//admin sign up

export default authRouter;
