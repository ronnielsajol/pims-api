import { eq, inArray, and, not } from "drizzle-orm";
import { db } from "../database/supabase.js";
import { Users } from "../models/users.model.js";

export const getUsers = async (req, res, next) => {
	try {
		const currentUser = req.user;

		if (currentUser.role === "property_custodian") {
			if (!currentUser.department) {
				return res.status(400).json({ success: false, message: "Custodian has no assigned department." });
			}

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

		for (const role of allowedRoles) {
			if (role === "admin" && currentUser.role !== "master_admin") {
				return res.status(403).json({ error: "Forbidden: Only master_admin can view admins" });
			}

			if (role === "staff" && !["property_custodian", "admin", "master_admin"].includes(currentUser.role)) {
				return res.status(403).json({ error: "Forbidden: Only property custodians can view staff" });
			}

			if (role === "property_custodian" && !["admin", "master_admin"].includes(currentUser.role)) {
				return res.status(403).json({ error: "Forbidden: Only admin or master_admin can view property custodians" });
			}
		}

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
				department: Users.department,
				role: Users.role,
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

/**
 * @desc    Update a user's details
 * @route   PATCH /api/v1/users/:id
 * @access  Private (Master Admin only)
 */
export const updateUser = async (req, res, next) => {
	try {
		const userIdToUpdate = parseInt(req.params.id);
		const { name, email, role, department } = req.body;
		const loggedInUser = req.user;
		console.log("Logged In User:", loggedInUser);

		// Authorization: Only a master admin can edit users.
		if (loggedInUser.role !== "master_admin" && loggedInUser.role !== "admin") {
			return res.status(403).json({ success: false, message: "Forbidden: You do not have permission to edit users." });
		}

		// Fetch the user to be updated
		const userToUpdateResult = await db.select().from(Users).where(eq(Users.id, userIdToUpdate)).limit(1);
		if (userToUpdateResult.length === 0) {
			return res.status(404).json({ success: false, message: "User not found." });
		}
		const userToUpdate = userToUpdateResult[0];

		const editorRole = loggedInUser.role;
		console.log("Editor Role:", editorRole);
		const targetUserRole = userToUpdate.role;
		console.log("Target User Role:", targetUserRole);

		if (editorRole === "master_admin") {
			// Master admin can edit anyone except other master admins (unless it's themselves)
			if (targetUserRole === "master_admin" && loggedInUser.id !== userIdToUpdate) {
				return res.status(403).json({ success: false, message: "Master admins cannot edit other master admins." });
			}
		} else if (editorRole === "admin") {
			// Admins can only edit custodians and staff
			if (targetUserRole !== "property_custodian" && targetUserRole !== "staff") {
				return res.status(403).json({ success: false, message: "Admins can only edit Property Custodians and Staff." });
			}
			// Admins cannot promote users to a higher or equal role
			if (role === "admin" || role === "master_admin") {
				return res.status(403).json({ success: false, message: "Admins cannot set roles to Admin or Master Admin." });
			}
		} else {
			// All other roles (custodian, staff) cannot edit users through this endpoint.
			return res.status(403).json({ success: false, message: "You do not have permission to edit users." });
		}
		// Validation 1: Prevent duplicate email
		if (email) {
			const existingUserWithEmail = await db
				.select()
				.from(Users)
				.where(and(eq(Users.email, email), not(eq(Users.id, userIdToUpdate))))
				.limit(1);
			if (existingUserWithEmail.length > 0) {
				return res.status(409).json({ success: false, message: `Email '${email}' is already in use.` });
			}
		}

		const newRole = role || userToUpdate.role;
		const newDepartment = department !== undefined ? department : userToUpdate.department;

		if (newRole === "property_custodian" && newDepartment) {
			const existingCustodianInDept = await db
				.select()
				.from(Users)
				.where(
					and(eq(Users.role, "property_custodian"), eq(Users.department, newDepartment), not(eq(Users.id, userIdToUpdate)))
				)
				.limit(1);

			if (existingCustodianInDept.length > 0) {
				return res
					.status(409)
					.json({ success: false, message: `Department '${newDepartment}' already has an assigned custodian.` });
			}
		}

		// Build the update object with only the fields that were provided
		const updateData = {};
		if (name) updateData.name = name;
		if (email) updateData.email = email;
		if (role) updateData.role = role;
		if (department) updateData.department = department;

		if (Object.keys(updateData).length === 0) {
			return res.status(400).json({ success: false, message: "No update data provided." });
		}

		// Perform the update
		const [updatedUser] = await db.update(Users).set(updateData).where(eq(Users.id, userIdToUpdate)).returning({
			id: Users.id,
			name: Users.name,
			email: Users.email,
			role: Users.role,
			department: Users.department,
		});

		res.status(200).json({ success: true, message: "User updated successfully", data: updatedUser });
	} catch (error) {
		next(error);
	}
};

/**
 * @desc    Delete a user
 * @route   DELETE /api/v1/users/:id
 * @access  Private (Master Admin only)
 */
export const deleteUser = async (req, res, next) => {
	try {
		const userIdToDelete = parseInt(req.params.id);
		const loggedInUser = req.user;

		if (loggedInUser.role !== "master_admin") {
			return res.status(403).json({ success: false, message: "Forbidden: You do not have permission to delete users." });
		}

		if (loggedInUser.id === userIdToDelete) {
			return res.status(400).json({ success: false, message: "You cannot delete your own account." });
		}

		const [deletedUser] = await db.delete(Users).where(eq(Users.id, userIdToDelete)).returning();

		if (!deletedUser) {
			return res.status(404).json({ success: false, message: "User not found." });
		}

		res.status(200).json({ success: true, message: "User deleted successfully." });
	} catch (error) {
		if (error.code === "23503") {
			return res.status(409).json({
				success: false,
				message: "Cannot delete user. They still have properties assigned to them. Please reassign the properties first.",
			});
		}
		next(error);
	}
};
