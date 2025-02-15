require('dotenv').config()
const apiKey = process.env.API_KEY;

function checkApiKey(req, res, next) {
	if (req.path.startsWith("/v1/api")) {
		const providedKey = req.headers["x-api-key"];

		if (!providedKey || providedKey !== apiKey) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		next();
	} else {
		next();
	}
}

module.exports = { checkApiKey };
