import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";
import { db } from "../database/supabase.js";
import { Users } from "../models/users.model.js";
import { eq } from "drizzle-orm";

export const authorizeOptional = async (req, res, next) => {
	const token = req.cookies.token;

	if (token) {
		try {
			const decoded = jwt.verify(token, JWT_SECRET);

			if (decoded && decoded.userId) {
				const userResult = await db.select().from(Users).where(eq(Users.id, decoded.userId)).limit(1);

				if (userResult.length > 0) {
					const { password: _, ...userData } = userResult[0];
					req.user = userData;
				}
			}
		} catch (err) {
			console.warn("Optional auth: A token was present but was invalid or expired.");
		}
	}
	next();
};
