import { Request, Response, NextFunction } from "express";

interface CustomError extends Error {
	statusCode?: number;
	code?: string;
}

const errorMiddleware = (err: CustomError, req: Request, res: Response, next: NextFunction): void => {
	try {
		let error: CustomError = { ...err };
		error.message = err.message;

		console.error("❌ Error:", err);

		if (err.code) {
			switch (err.code) {
				case "23505":
					error.message = "Duplicate entry. This record already exists.";
					error.statusCode = 409;
					break;
				case "23503":
					error.message = "Foreign key constraint violated.";
					error.statusCode = 400;
					break;
				case "23502":
					error.message = "A required field is missing.";
					error.statusCode = 400;
					break;
				case "22P02":
					error.message = "Invalid data type provided.";
					error.statusCode = 400;
					break;
				case "42601":
					error.message = "Syntax error in SQL statement.";
					error.statusCode = 400;
					break;
				case "40P01":
					error.message = "Deadlock detected. Try again.";
					error.statusCode = 500;
					break;
				case "25P02":
					error.message = "Transaction is in an invalid state.";
					error.statusCode = 500;
					break;
				case "ECONNREFUSED":
					error.message = "Database connection was refused.";
					error.statusCode = 500;
					break;
				case "ETIMEDOUT":
					error.message = "Database connection timed out.";
					error.statusCode = 500;
					break;
				default:
					error.message = "An unknown database error occurred.";
					error.statusCode = 500;
					break;
			}
		}

		res.status(error.statusCode || 500).json({
			success: false,
			message: error.message || "Server Error",
		});
	} catch (err) {
		next(err);
	}
};

export default errorMiddleware;
