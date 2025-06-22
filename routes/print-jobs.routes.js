import { Router } from "express";
import { createPrintJob, getAllPrintJobs, getNextPrintJob } from "../controllers/print-jobs.controller.js";
import authorize from "../middleware/auth.middleware.js";
import checkRole from "../middleware/checkRole.middleware.js";

const printJobsRouter = Router();

printJobsRouter.get("/next", getNextPrintJob);

printJobsRouter.use(authorize);

printJobsRouter.get("/", checkRole(["master_admin", "admin"]), getAllPrintJobs);

printJobsRouter.post(
	"/create",
	checkRole(["master_admin", "admin", "property_custodian"]), // Only these roles can print
	createPrintJob
);

// === This route is for your ESP32 device ===
// It is public so the device can poll it without needing a token.

export default printJobsRouter;
