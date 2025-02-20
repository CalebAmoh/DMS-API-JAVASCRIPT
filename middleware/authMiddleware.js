require('dotenv').config()
const apiKey = process.env.API_KEY;
const jwt = require("jsonwebtoken");
const helper = require("../controllers/helper");
const { access } = require('fs');
const passwordResetTokenCollection = "password_reset_tokens";

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

const checkToken = (req, res, next) => {
	try {
		const token = req.headers.authorization || req.headers.Authorization;
		if (!token?.startsWith("Bearer ")) {
			return res.status(401).json({ error: "Unauthorized" });
		}
		
		access_token = token.split(" ")[1];
		// console.log(access_token)
		jwt.verify(access_token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
			if (err) {
				return res.status(403).json({ error: "Forbidden" });
			}

			// console.log(user);
			req.email = user.email;
			next();
		});
	} catch (error) {
		console.log(error)
		
	}
	
};

const handleRefreshToken = async (req, res) => {

	try {
		const cookies = req.cookies;
		!cookies?.refreshToken && res.status(401).json({ error: "Unauthorized" });

		refreshToken = cookies.refreshToken;

		//select refresh token from db 
		const user = await helper.selectRecordsWithCondition(passwordResetTokenCollection, [{token: refreshToken}]);
		if (user.status === "success" ){
			const userToken = user.message[0].token;
			const email = user.message[0].email;

			//compare the token from the db with the token in the cookie to ensure they are the same token 
			userToken !== refreshToken && res.status(401).json({ error: "Unauthorized" });

			//verify the token
			jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
				if (err || user.email !== email) {
					console.log(err);
					return res.status(403).json({ error: "Forbidden 11" });
				}

				accessToken = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "15m" });
				res.json({ accessToken });
			});
		}else{
			res.status(403).json({ result: user.message, code: "403" });
		}
	} catch (error) {
		console.log(error);
		res.status(500).json({ error: "Internal Server Error" });
	}
	
}

module.exports = { checkApiKey, checkToken, handleRefreshToken };
