import { Request, Response, NextFunction } from "express";
import { db } from "../database/supabase";
import { Users } from "../models/users.model";
import { env } from "../config/env";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";

interface AuthRequest extends Request {
	body: {
		name?: string;
		email: string;
		password: string;
		role?: string;
	};
}

const secret = env.JWT_SECRET;
const expiresIn = env.JWT_EXPIRES_IN;

if (!secret) {
	throw new Error("JWT_SECRET environment variable is not set.");
}
if (!expiresIn) {
	throw new Error("JWT_EXPIRES_IN environment variable is not set.");
}

export const signUp = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		const { name, email, password } = req.body;

		if (!name || !email || !password) {
			return res.status(400).json({ success: false, message: "Missing required fields" });
		}

		// Check if the user already exists
		const existingUser = await db.select().from(Users).where(eq(Users.email, email));
		if (existingUser.length > 0) {
			return res.status(409).json({ success: false, message: "User already exists" });
		}

		// Hash the password before storing
		const hashedPassword = await bcrypt.hash(password, 10);

		// Insert new user and return the inserted row
		const [newUser] = await db.insert(Users).values({ name, email, password: hashedPassword }).returning();

		const token = jwt.sign({ userId: newUser?.id }, env.JWT_SECRET, {
			expiresIn: "1d",
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

export const adminSignUp = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		const { name, email, password, role } = req.body;

		if (!name || !email || !password) {
			return res.status(400).json({ success: false, message: "Missing required fields" });
		}

		if (!role) {
			return res.status(401).json({ success: false, message: "Unauthorized: Admin role required" });
		}

		const existingUser = await db.select().from(Users).where(eq(Users.email, email));

		if (existingUser.length > 0) {
			return res.status(409).json({ success: false, message: "User already exists" });
		}

		const salt = await bcrypt.genSalt(10);
		const hashedPassword = await bcrypt.hash(password, salt);

		const [newUser] = await db.insert(Users).values({ name, email, password: hashedPassword, role }).returning();

		const token = jwt.sign({ userId: newUser.id, role }, env.JWT_SECRET, {
			expiresIn: "1d",
		});

		res.status(201).json({
			success: true,
			message: "Admin registered successfully",
			data: { token, user: newUser },
		});
	} catch (error) {
		next(error);
	}
};

export const signIn = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		const { email, password } = req.body;

		if (!email || !password) {
			return res.status(400).json({ success: false, message: "Missing required fields" });
		}

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
		const token = jwt.sign({ userId: user.id, role: user.role }, env.JWT_SECRET, {
			expiresIn: "1d",
		});

		res.status(200).json({
			success: true,
			message: "Login successful",
			data: { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } },
		});
	} catch (error) {
		next(error);
	}
};

export const signOut = async (_req: Request, res: Response) => {
	res.status(200).json({ success: true, message: "Sign out successful" });
};
