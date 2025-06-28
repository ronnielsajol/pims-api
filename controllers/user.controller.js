import { eq, inArray, and } from "drizzle-orm";
import { db } from "../database/supabase.js";
import { Users } from "../models/users.model.js";

export const getUsers = async (req, res, next) => {
	try {
		const currentUser = req.user;

		// --- CUSTODIAN-SPECIFIC LOGIC ---
		// If the logged-in user is a custodian, we apply a more restrictive logic
		// that overrides any query parameters for security.
		if (currentUser.role === "property_custodian") {
			if (!currentUser.department) {
				// A custodian must have a department assigned to view staff.
				return res.status(400).json({ success: false, message: "Custodian has no assigned department." });
			}

			// This query specifically fetches ONLY staff members from the custodian's own department.
			const staffInDepartment = await db
				.select({
					id: Users.id,
					name: Users.name,
					email: Users.email,
					role: Users.role,
					department: Users.department,
				})
				.from(Users)
				.where(and(eq(Users.department, currentUser.department), eq(Users.role, "staff")))
				.orderBy(Users.id);

			return res.status(200).json({ success: true, data: staffInDepartment });
		}

		// --- ADMIN/Master Admin-SPECIFIC LOGIC ---
		const roles = req.query.roles;
		const allowedRoles = Array.isArray(roles) ? roles : roles ? [roles] : [];

		if (!roles) {
			return res.status(400).json({ error: "Bad Request: roles query parameter is required" });
		}

		// Authorization logic for Admins and Master Admins
		for (const role of allowedRoles) {
			// Only master_admin can view other admins
			if (role === "admin" && currentUser.role !== "master_admin") {
				return res.status(403).json({ error: "Forbidden: Only master_admin can view admins" });
			}

			// Only property_custodian can view staff (this rule is now primarily handled above)
			if (role === "staff" && !["property_custodian", "admin", "master_admin"].includes(currentUser.role)) {
				return res.status(403).json({ error: "Forbidden: Only property custodians can view staff" });
			}

			// Only admin and master_admin can view property custodians
			if (role === "property_custodian" && !["admin", "master_admin"].includes(currentUser.role)) {
				return res.status(403).json({ error: "Forbidden: Only admin or master_admin can view property custodians" });
			}
		}

		// Build the query for Admins/Master Admins
		const query = db
			.select({ id: Users.id, name: Users.name, email: Users.email, role: Users.role, department: Users.department })
			.from(Users)
			.where(inArray(Users.role, allowedRoles))
			.orderBy(Users.id);

		const users = await query;
		return res.status(200).json({ success: true, data: users });
	} catch (error) {
		next(error);
	}
};
export const getUserById = async (req, res, next) => {
	try {
		const user = await db
			.select({
				id: Users.id,
				name: Users.name,
				email: Users.email,
			})
			.from(Users)
			.where(eq(Users.id, req.params.id));

		if (!user) {
			const error = new Error("User not found");
			error.status = 404;
			throw error;
		}

		res.status(200).json({ success: true, data: user });
	} catch (error) {
		next(error);
	}
};
