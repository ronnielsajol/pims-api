import { eq } from "drizzle-orm";
import { db } from "../database/supabase.js";
import { Users } from "../models/users.model.js";

export const getAllUsers = async (req, res, next) => {
	try {
		const users = await db
			.select({
				id: Users.id,
				name: Users.name,
				email: Users.email,
				role: Users.role,
			})
			.from(Users);

		res.status(200).json({ success: true, data: users });
	} catch (error) {
		next(error);
	}
};

export const getUsers = async (req, res, next) => {
	try {
		const users = await db
			.select({
				id: Users.id,
				name: Users.name,
				email: Users.email,
			})
			.from(Users)
			.where(eq(Users.role, "staff"))
			.orderBy(Users.id, "asc");

		res.status(200).json({ success: true, data: users });
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
		const admins = await db
			.select({
				id: Users.id,
				name: Users.name,
				email: Users.email,
			})
			.from(Users)
			.where(eq(Users.role, "admin"))
			.orderBy(Users.id, "asc");

		res.status(200).json({ success: true, data: admins });
	} catch (error) {
		next(error);
	}
};
