import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";
import { Users } from "../models/users.model.js";
import { eq } from "drizzle-orm";
import { db } from "../database/supabase.js";

const authorize = async (req, res, next) => {
	try {
		let token;

		if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
			token = req.headers.authorization.split(" ")[1];
		}

		if (!token) {
			return res.status(401).json({ message: "Unauthorized: No token provided" });
		}

		const decoded = jwt.verify(token, JWT_SECRET);
		if (!decoded || !decoded.userId) {
			return res.status(401).json({ message: "Unauthorized: Invalid token" });
		}
		const user = await db.select().from(Users).where(eq(Users.id, decoded.userId)).limit(1);
		if (!user.length) {
			return res.status(401).json({ message: "Unauthorized: User not found" });
		}

		req.user = user[0];

		next();
	} catch (error) {
		console.error("Authentication error:", error.message);

		res.status(401).json({ message: "Unauthorized", error: error.message });
	}
};

export default authorize;
