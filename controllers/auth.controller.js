import { db, pool } from "../database/pg.js";
import { users } from "../models/users.model.js";
import { JWT_EXPIRES_IN, JWT_SECRET } from "../config/env.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";

export const signUp = async (req, res, next) => {
	const client = await pool.connect(); // Get a client connection
	try {
		await client.query("BEGIN"); // Start transaction

		const { name, email, password } = req.body;

		// Check if the user already exists
		const existingUser = await db.select().from(users).where(eq(users.email, email));

		if (existingUser.length > 0) {
			const error = new Error("User already exists");
			error.statusCode = 409;
			throw error;
		}

		// Hash the password before storing
		const salt = await bcrypt.genSalt(10);
		const hashedPassword = await bcrypt.hash(password, salt);

		// Insert new user and return the inserted row
		const newUser = await db
			.insert(users)
			.values({
				name,
				email,
				password: hashedPassword,
			})
			.returning();

		// Generate JWT token
		const token = jwt.sign({ userId: newUser[0].id }, JWT_SECRET, {
			expiresIn: JWT_EXPIRES_IN,
		});

		await client.query("COMMIT"); // Commit transaction
		client.release(); // Release client back to the pool

		res.status(201).json({
			success: true,
			message: "User registered successfully",
			data: {
				token,
				user: newUser[0],
			},
		});
	} catch (error) {
		await client.query("ROLLBACK"); // Rollback in case of error
		client.release(); // Ensure client is released even in errors
		next(error);
	}
};

export const signIn = async (req, res, next) => {
	try {
		const { email, password } = req.body;

		// Check if user exists
		const existingUser = await db.select().from(users).where(eq(users.email, email));

		if (existingUser.length === 0) {
			const error = new Error("User not found");
			error.statusCode = 404;
			throw error;
		}

		const user = existingUser[0];

		// Compare password
		const isPasswordValid = await bcrypt.compare(password, user.password);

		if (!isPasswordValid) {
			const error = new Error("Invalid credentials");
			error.statusCode = 401;
			throw error;
		}

		// Generate JWT token
		const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
			expiresIn: JWT_EXPIRES_IN,
		});

		res.status(200).json({
			success: true,
			message: "Login successful",
			data: {
				token,
				user: {
					id: user.id,
					name: user.name,
					email: user.email,
				},
			},
		});
	} catch (error) {
		next(error);
	}
};

export const signOut = async (req, res, next) => {};
