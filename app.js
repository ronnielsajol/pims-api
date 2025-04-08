import express from "express";
import { PORT } from "./config/env.js";

import userRouter from "./routes/user.routes.js";
import authRouter from "./routes/auth.routes.js";
import propertiesRouter from "./routes/properties.routes.js";
import { checkDBConnection } from "./database/supabase.js";
import errorMiddleware from "./middleware/error.middleware.js";
import cookieParser from "cookie-parser";
import cors from "cors";

const app = express();

app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.options("*", cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/properties", propertiesRouter);

app.use(errorMiddleware);

app.get("/", (req, res) => {
	res.send({ message: "Welcome to PIMS API" });
});

app.listen(PORT, async () => {
	console.log(`Server is running on port ${PORT}`);

	await checkDBConnection();
});

export default app;
