// In your API project: setup-master-admin.js

import inquirer from "inquirer";
import bcrypt from "bcryptjs";
import { db } from "./database/supabase.js"; // ✅ Adjust path to your db file
import { Users } from "./models/users.model.js"; // ✅ Adjust path to your users model

const setupAdmin = async () => {
	console.log("--- Master Admin Account Setup ---");
	console.log("This script will create the initial Master Admin user.");

	try {
		// 1. Prompt for user details
		const answers = await inquirer.prompt([
			{
				type: "input",
				name: "name",
				message: "Enter the Master Admin's full name:",
				validate: (input) => (input ? true : "Name cannot be empty."),
			},
			{
				type: "input",
				name: "email",
				message: "Enter the Master Admin's email address:",
				validate: (input) => {
					const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
					return emailRegex.test(input) ? true : "Please enter a valid email address.";
				},
			},
			{
				type: "password",
				name: "password",
				message: "Enter a strong password for the Master Admin:",
				mask: "*",
				validate: (input) => (input.length >= 8 ? true : "Password must be at least 8 characters long."),
			},
			{
				type: "password",
				name: "confirmPassword",
				message: "Confirm the password:",
				mask: "*",
				validate: (input, answers) => (input === answers.password ? true : "Passwords do not match."),
			},
		]);

		// 2. Hash the password
		console.log("Hashing password...");
		const saltRounds = 10;
		const hashedPassword = await bcrypt.hash(answers.password, saltRounds);

		// 3. Insert the new user into the database
		console.log(`Creating user for ${answers.email}...`);
		const [newUser] = await db
			.insert(Users)
			.values({
				name: answers.name,
				email: answers.email,
				password: hashedPassword,
				role: "master_admin",
			})
			.returning({ id: Users.id, name: Users.name, email: Users.email });

		console.log("✅ Master Admin created successfully!");
		console.log(`   ID: ${newUser.id}`);
		console.log(`   Name: ${newUser.name}`);
		console.log(`   Email: ${newUser.email}`);
	} catch (error) {
		if (error.code === "23505") {
			console.error("❌ Error: An account with this email address already exists.");
		} else {
			console.error("❌ An unexpected error occurred:", error);
		}
	} finally {
		// You might need to manually close your database connection depending on your driver
		// For example, if using 'pg': await db.end();
		process.exit(0);
	}
};

setupAdmin();
