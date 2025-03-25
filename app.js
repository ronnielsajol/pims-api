import express from "express";
import { PORT } from "./config/env.js";

import userRouter from "./routes/user.routes.js";
import authRouter from "./routes/auth.routes.js";
import checkDBConnection from "./database/pg.js";

const app = express();

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);

app.get("/", (req, res) => {
	res.send("Welcome!");
});

app.listen(PORT, async () => {
	console.log(`Server is running on port ${PORT}`);

	await checkDBConnection();
});

export default app;
