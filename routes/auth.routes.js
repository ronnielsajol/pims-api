import { Router } from "express";
import { getMe, signIn, signOut, signUp } from "../controllers/auth.controller.js";
import { authorizeOptional } from "../middleware/authorizeOptional.middleware.js";
import authorize from "../middleware/auth.middleware.js";

const authRouter = Router();

authRouter.post("/sign-up", authorizeOptional, signUp);
authRouter.post("/sign-in", signIn);
authRouter.get("/sign-out", signOut);

authRouter.get("/me", authorize, getMe);

export default authRouter;
