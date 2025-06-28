import { eq, inArray } from "drizzle-orm";
import { db } from "../database/supabase.js";
import { Users } from "../models/users.model.js";

export const getUsers = async (req, res, next) => {
	try {
		const roles = req.query.roles;
		const allowedRoles = Array.isArray(roles) ? roles : roles ? [roles] : [];

		if (!roles) {
			return res.status(400).json({ error: "Bad Request: roles query parameter is required" });
		}

		// Authorization logic
		for (const role of allowedRoles) {
			// Only master_admin can view admins
			if (role === "admin" && req.user.role !== "master_admin") {
				return res.status(403).json({ error: "Forbidden: Only master_admin can view admins" });
			}

			// Only property_custodian can view staff
			if (role === "staff" && !["property_custodian", "admin", "master_admin"].includes(req.user.role)) {
				return res.status(403).json({ error: "Forbidden: Only property custodians can view staff" });
			}

			// Only admin and master_admin can view property custodians
			if (role === "property_custodian" && !["admin", "master_admin"].includes(req.user.role)) {
				return res.status(403).json({ error: "Forbidden: Only admin or master_admin can view property custodians" });
			}
		}

		// Build query
		let query = db
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
