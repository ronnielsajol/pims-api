import { db } from "../database/supabase.js";
import { sql, eq, count, desc } from "drizzle-orm";
import { Properties } from "../models/properties.model.js";
import { Users } from "../models/users.model.js";
import { ReassignmentRequests } from "../models/reassignment-requests.model.js";
import { CustodianAssignments } from "../models/custodian-assignments.model.js";

/**
 * @desc    Get statistics for the Admin/Master Admin dashboard
 * @route   GET /api/v1/dashboard/admin-stats
 * @access  Private (Admin, Master Admin)
 */
export const getAdminDashboardStats = async (req, res, next) => {
	try {
		// We will run all these aggregate queries in parallel for maximum efficiency.

		// 1. Get total number of properties
		const totalPropertiesQuery = db.select({ value: count(Properties.id) }).from(Properties);

		// 2. Get the total value of all assets
		const totalAssetValueQuery = db
			.select({ value: sql`sum(CAST(${Properties.quantity} AS numeric) * CAST(${Properties.value} AS numeric))` })
			.from(Properties);

		// 3. Get total number of users
		const totalUsersQuery = db.select({ value: count(Users.id) }).from(Users);

		// 4. Get count of pending reassignment requests
		const pendingApprovalsQuery = db
			.select({ value: count() })
			.from(ReassignmentRequests)
			.where(eq(ReassignmentRequests.status, "pending"));

		// --- Data for Charts ---

		// 5. Get property count per department
		const propertiesByDeptQuery = db
			.select({
				department: CustodianAssignments.assigned_department,
				count: count(CustodianAssignments.propertyId),
			})
			.from(CustodianAssignments)
			.groupBy(CustodianAssignments.assigned_department)
			.orderBy(desc(count(CustodianAssignments.propertyId)));

		// 6. Get property count per category
		const assetsByCategoryQuery = db
			.select({
				category: Properties.category,
				count: count(Properties.id),
			})
			.from(Properties)
			.groupBy(Properties.category);

		// Execute all queries at the same time
		const [
			totalPropertiesResult,
			totalAssetValueResult,
			totalUsersResult,
			pendingApprovalsResult,
			propertiesByDeptResult,
			assetsByCategoryResult,
		] = await Promise.all([
			totalPropertiesQuery,
			totalAssetValueQuery,
			totalUsersQuery,
			pendingApprovalsQuery,
			propertiesByDeptQuery,
			assetsByCategoryQuery,
		]);

		// Structure the final response object
		const stats = {
			totalProperties: totalPropertiesResult[0]?.value || 0,
			totalAssetValue: parseFloat(totalAssetValueResult[0]?.value) || 0,
			totalUsers: totalUsersResult[0]?.value || 0,
			pendingApprovals: pendingApprovalsResult[0]?.value || 0,
			propertiesByDepartment: propertiesByDeptResult,
			assetsByCategory: assetsByCategoryResult,
		};

		res.status(200).json({ success: true, data: stats });
	} catch (error) {
		next(error);
	}
};
