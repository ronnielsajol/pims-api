import { db } from "../database/supabase.js";
import { Users } from "../models/users.model.js";
import { JWT_EXPIRES_IN, JWT_SECRET } from "../config/env.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";

export const signUp = async (req, res, next) => {
	try {
		const { name, email, password } = req.body;

		// Check if the user already exists
		const existingUser = await db.select().from(Users).where(eq(Users.email, email));
		if (existingUser.length > 0) {
			return res.status(409).json({ success: false, message: "User already exists" });
		}

		// Hash the password before storing
		const hashedPassword = await bcrypt.hash(password, 10);

		// Insert new user and return the inserted row
		const [newUser] = await db.insert(Users).values({ name, email, password: hashedPassword }).returning();

		// Generate JWT token
		const token = jwt.sign({ userId: newUser.id }, JWT_SECRET, {
			expiresIn: JWT_EXPIRES_IN,
		});

		res.status(201).json({
			success: true,
			message: "User registered successfully",
			data: { token, user: newUser },
		});
	} catch (error) {
		next(error);
	}
};

export const signIn = async (req, res, next) => {
	try {
		const { email, password } = req.body;

		// Check if user exists
		const existingUser = await db.select().from(Users).where(eq(Users.email, email));
		if (existingUser.length === 0) {
			return res.status(404).json({ success: false, message: "User not found" });
		}

		const user = existingUser[0];

		// Compare password
		const isPasswordValid = await bcrypt.compare(password, user.password);
		if (!isPasswordValid) {
			return res.status(401).json({ success: false, message: "Invalid credentials" });
		}

		// Generate JWT token
		const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
			expiresIn: JWT_EXPIRES_IN,
		});

		res.status(200).json({
			success: true,
			message: "Login successful",
			data: { token, user: { id: user.id, name: user.name, email: user.email } },
		});
	} catch (error) {
		next(error);
	}
};

export const signOut = async (req, res) => {
	res.status(200).json({ success: true, message: "Sign out successful" });
};
