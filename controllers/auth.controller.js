import { pool } from "../database/pg.js";

export const signUp = async (req, res, next) => {
	const session = await pool.connect();
};

export const signIn = async (req, res, next) => {};

export const signOut = async (req, res, next) => {};
