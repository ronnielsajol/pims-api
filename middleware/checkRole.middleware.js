const checkRole = (roles) => {
	return (req, res, next) => {
		// console.log("Roles being checked:", roles); // Debugging line
		// console.log("User Role:", req.user?.role);
		if (!req.user || !roles.includes(req.user.role)) {
			return res.status(403).json({ message: "Forbidden: Insufficient permission" });
		}
		next();
	};
};

export default checkRole;
