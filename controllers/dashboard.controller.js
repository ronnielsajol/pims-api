import { db } from "../database/supabase.js";
import { sql, eq, count, desc, and, aliasedTable } from "drizzle-orm";
import { Properties } from "../models/properties.model.js";
import { Users } from "../models/users.model.js";
import { ReassignmentRequests } from "../models/reassignment-requests.model.js";
import { CustodianAssignments } from "../models/custodian-assignments.model.js";
import { StaffAssignments } from "../models/staff-assignments.model.js";
import { PropertyDetails } from "../models/property-details.model.js";

/**
 * @desc    Get statistics for the Admin/Master Admin dashboard
 * @route   GET /api/v1/dashboard/admin-stats
 * @access  Private (Admin, Master Admin)
 */
export const getAdminDashboardStats = async (req, res, next) => {
	try {
		const user = req.user; // Get the logged-in user from the authorize middleware

		// --- Define all queries ---
		const totalPropertiesQuery = db.select({ value: count(Properties.id) }).from(Properties);

		const totalAssetValueQuery = db
			.select({ value: sql`sum(CAST(${Properties.quantity} AS numeric) * CAST(${Properties.value} AS numeric))` })
			.from(Properties);

		const totalUsersQuery = db.select({ value: count(Users.id) }).from(Users);

		const propertiesByDeptQuery = db
			.select({
				department: CustodianAssignments.assigned_department,
				count: count(CustodianAssignments.propertyId),
			})
			.from(CustodianAssignments)
			.groupBy(CustodianAssignments.assigned_department)
			.orderBy(desc(count(CustodianAssignments.propertyId)));

		const assetsByCategoryQuery = db
			.select({
				category: Properties.category,
				count: count(Properties.id),
			})
			.from(Properties)
			.groupBy(Properties.category);

		// Conditional Query for Pending Approvals
		let pendingApprovalsQuery;
		if (user.role === "master_admin") {
			pendingApprovalsQuery = db
				.select({ value: count() })
				.from(ReassignmentRequests)
				.where(eq(ReassignmentRequests.status, "pending"));
		} else {
			pendingApprovalsQuery = Promise.resolve([{ value: 0 }]);
		}

		// Execute all queries in parallel
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

export const getCustodianDashboardStats = async (req, res, next) => {
	try {
		const user = req.user;
		const custodianDepartment = user.department;

		if (!custodianDepartment) {
			return res.status(400).json({ success: false, message: "Custodian has no assigned department." });
		}

		const propertiesInDeptQuery = db
			.select({ value: count() })
			.from(CustodianAssignments)
			.where(eq(CustodianAssignments.custodianId, user.id));

		const ca = aliasedTable(CustodianAssignments, "ca");
		const p = aliasedTable(Properties, "p");

		const valueOfAssetsQuery = db
			.select({ value: sql`sum(CAST(${p.quantity} AS numeric) * CAST(${p.value} AS numeric))` })
			.from(ca)
			.leftJoin(p, eq(ca.propertyId, p.id))
			.where(eq(ca.custodianId, user.id));

		const staffInDeptQuery = db
			.select({ value: count() })
			.from(Users)
			.where(and(eq(Users.department, custodianDepartment), eq(Users.role, "staff")));

		const staffUser = aliasedTable(Users, "staff");
		const recentPropertiesQuery = db
			.select({
				id: Properties.id,
				propertyNo: Properties.propertyNo,
				description: Properties.description,
				delegatedTo: staffUser.name,
				lastUpdated: Properties.updatedAt,
			})
			.from(CustodianAssignments)
			.where(eq(CustodianAssignments.custodianId, user.id))
			.innerJoin(Properties, eq(CustodianAssignments.propertyId, Properties.id))
			.leftJoin(StaffAssignments, eq(Properties.id, StaffAssignments.propertyId))
			.leftJoin(staffUser, eq(StaffAssignments.staffId, staffUser.id))
			.orderBy(desc(Properties.updatedAt))
			.limit(5);

		const [propertiesInDeptResult, valueOfAssetsResult, staffInDeptResult, recentPropertiesResult] = await Promise.all([
			propertiesInDeptQuery,
			valueOfAssetsQuery,
			staffInDeptQuery,
			recentPropertiesQuery,
		]);

		const stats = {
			propertiesInDepartment: propertiesInDeptResult[0]?.value || 0,
			valueOfAssets: parseFloat(valueOfAssetsResult[0]?.value) || 0,
			staffInDepartment: staffInDeptResult[0]?.value || 0,
			recentProperties: recentPropertiesResult,
		};

		res.status(200).json({ success: true, data: stats });
	} catch (error) {
		next(error);
	}
};

export const getStaffDashboardStats = async (req, res, next) => {
	try {
		const user = req.user;

		// 1. Get a count of all items assigned to the current staff member
		const assignedItemsCountQuery = db
			.select({ value: count() })
			.from(StaffAssignments)
			.where(eq(StaffAssignments.staffId, user.id));

		// 2. Get the full list of assigned items with their details
		const assignedItemsQuery = db
			.select({
				id: Properties.id,
				propertyNo: Properties.propertyNo,
				description: Properties.description,
				condition: PropertyDetails.condition,
				dateAssigned: StaffAssignments.assignedAt,
			})
			.from(StaffAssignments)
			.where(eq(StaffAssignments.staffId, user.id))
			.innerJoin(Properties, eq(StaffAssignments.propertyId, Properties.id))
			.leftJoin(PropertyDetails, eq(Properties.id, PropertyDetails.propertyId))
			.orderBy(desc(StaffAssignments.assignedAt));

		// Execute both queries in parallel
		const [countResult, itemsResult] = await Promise.all([assignedItemsCountQuery, assignedItemsQuery]);

		const stats = {
			assignedItemsCount: countResult[0]?.value || 0,
			assignedItems: itemsResult,
		};

		res.status(200).json({ success: true, data: stats });
	} catch (error) {
		next(error);
	}
};
