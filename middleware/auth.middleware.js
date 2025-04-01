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
			return res.status(401).json({ message: "Unauthorized" });
		}

		const decoded = jwt.verify(token, JWT_SECRET);

		const user = await db.select().from(Users).where(eq(Users.id, decoded.userId)).limit(1);
		if (!user) {
			return res.status(401).json({ message: "Unauthorized" });
		}

		req.user = user[0]; // Attach user to request object

		next();
	} catch (error) {
		res.status(401).json({ message: "Unauthorized", error: error.message });
	}
};

export default authorize;
