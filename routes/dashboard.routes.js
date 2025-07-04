import { Router } from "express";
import {
	getAdminDashboardStats,
	getCustodianDashboardStats,
	getStaffDashboardStats,
} from "../controllers/dashboard.controller.js";
import authorize from "../middleware/auth.middleware.js";

const dashboardRouter = Router();

dashboardRouter.use(authorize);

dashboardRouter.get("/admin-stats", getAdminDashboardStats);
dashboardRouter.get("/custodian-stats", getCustodianDashboardStats);
dashboardRouter.get("/staff-stats", getStaffDashboardStats);

export default dashboardRouter;
