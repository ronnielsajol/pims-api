import express from "express";
import { PORT } from "./config/env.js";

import userRouter from "./routes/user.routes.js";
import authRouter from "./routes/auth.routes.js";
import propertiesRouter from "./routes/properties.routes.js";
import { checkDBConnection } from "./database/supabase.js";
import errorMiddleware from "./middleware/error.middleware.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import printJobsRouter from "./routes/print-jobs.routes.js";

const app = express();

app.set("trust proxy", 1);

const whitelist = [
	"http://localhost:3000",
	"https://pims-client.vercel.app",
	"https://pims-client-git-desktop-httponly-ronniel-sajols-projects.vercel.app",
];

const corsOptions = {
	origin: function (origin, callback) {
		if (whitelist.indexOf(origin) !== -1 || !origin) {
			callback(null, true);
		} else {
			callback(new Error("Not allowed by CORS"));
		}
	},
	credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/properties", propertiesRouter);
app.use("/api/v1/print-jobs", printJobsRouter);

app.use(errorMiddleware);

app.get("/", (req, res) => {
	res.send({ message: "Welcome to PIMS API" });
});

app.listen(PORT, async () => {
	console.log(`Server is running on port ${PORT}`);

	await checkDBConnection();
});

export default app;
