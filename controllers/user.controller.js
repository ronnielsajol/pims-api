import { eq } from "drizzle-orm";
import { db } from "../database/supabase.js";
import { Users } from "../models/users.model.js";

export const getAllUsers = async (req, res, next) => {
	try {
		const users = await db.select().from(Users);

		res.status(200).json({ success: true, data: users });
	} catch (error) {
		next(error);
	}
};

export const getUsers = async (req, res, next) => {
	try {
		const users = await db.select().from(Users).where(eq(Users.role, "user"));

		res.status(200).json({ success: true, users });
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

export const getAdmins = async (req, res, next) => {
	try {
		const admins = await db.select().from(Users).where(eq(Users.role, "admin")); // Adjust based on your role column type

		res.status(200).json({ success: true, admins });
	} catch (error) {
		next(error);
	}
};
