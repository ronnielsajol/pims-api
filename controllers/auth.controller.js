import { db } from "../database/supabase.js";
import { Users } from "../models/users.model.js";
import { JWT_EXPIRES_IN, JWT_SECRET } from "../config/env.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { and, eq } from "drizzle-orm";

export const signUp = async (req, res, next) => {
	try {
		const { name, email, password, department, role } = req.body;
		const adminCreatingUser = req.user;

		// Authorization: Check if a non-admin is trying to assign a privileged role
		if (role && role !== "staff") {
			if (!adminCreatingUser || adminCreatingUser.role !== "master_admin") {
				return res.status(401).json({ success: false, message: "Only Master admin can assign roles" });
			}
		}
		if (role === "property_custodian" && department) {
			const existingCustodianInDept = await db
				.select()
				.from(Users)
				.where(and(eq(Users.role, "property_custodian"), eq(Users.department, department)))
				.limit(1);

			if (existingCustodianInDept.length > 0) {
				return res
					.status(409)
					.json({ success: false, message: `Department '${department}' already has an assigned custodian.` });
			}
		}

		// Validation: Check if the user already exists
		const existingUser = await db.select().from(Users).where(eq(Users.email, email));
		if (existingUser.length > 0) {
			return res.status(409).json({ success: false, message: "User already exists" });
		}

		// User Creation: Hash password and insert into DB
		const hashedPassword = await bcrypt.hash(password, 10);
		const [newUser] = await db
			.insert(Users)
			.values({ name, email, password: hashedPassword, department, role: role || "staff" })
			.returning();

		// Cleanup: Remove password from the user object that will be returned
		const { password: _, ...userToReturn } = newUser;

		if (!adminCreatingUser) {
			const token = jwt.sign({ userId: newUser.id, role: newUser.role }, JWT_SECRET, {
				expiresIn: JWT_EXPIRES_IN,
			});

			const cookieOptions = {
				httpOnly: true,
				expires: new Date(Date.now() + 24 * 60 * 60 * 1000 * 7), // 7 days
				secure: process.env.NODE_ENV === "production",
				sameSite: "none",
				path: "/",
			};

			res.cookie("token", token, cookieOptions);
		}

		// Always send a success response
		res.status(201).json({
			success: true,
			message: "User created successfully",
			data: { user: userToReturn }, // Send back the new user's data
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
		const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
			expiresIn: JWT_EXPIRES_IN,
		});

		const cookieOptions = {
			httpOnly: true,
			expires: new Date(Date.now() + 24 * 60 * 60 * 1000 * 7), // e.g., 7 days
			secure: true,
			sameSite: "none",
		};
		res.cookie("token", token, cookieOptions);

		const { password: _, ...userToReturn } = user;

		res.status(200).json({
			success: true,
			message: "Login successful",
			data: { user: userToReturn },
		});
	} catch (error) {
		next(error);
	}
};

export const signOut = (req, res) => {
	res.clearCookie("token", {
		httpOnly: true,
		secure: true,
		sameSite: "none",
		path: "/",
	});

	res.status(200).json({ success: true, message: "Sign out successful" });
};

export const getMe = (req, res) => {
	res.status(200).json({ user: req.user });
};
