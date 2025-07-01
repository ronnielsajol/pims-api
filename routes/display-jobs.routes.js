import { Router } from "express";
import { createDisplayJob, getNextDisplayJob } from "../controllers/display-jobs.controller.js";
import authorize from "../middleware/auth.middleware.js";

const displayJobsRouter = Router();

// This route is for your polling device
displayJobsRouter.get("/next", getNextDisplayJob);
// This route is for your frontend application to create a new job
displayJobsRouter.post(
	"/create",
	authorize, // Ensure user is logged in
	createDisplayJob
);

export default displayJobsRouter;
