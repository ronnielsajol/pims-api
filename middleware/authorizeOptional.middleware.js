import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";

export const authorizeOptional = (req, res, next) => {
	const authHeader = req.headers.authorization;

	if (authHeader && authHeader.startsWith("Bearer ")) {
		const token = authHeader.split(" ")[1];
		try {
			const decoded = jwt.verify(token, JWT_SECRET);
			req.user = decoded;
		} catch (err) {
			console.warn("Optional auth token invalid:", err.message);
		}
	}

	next();
};
