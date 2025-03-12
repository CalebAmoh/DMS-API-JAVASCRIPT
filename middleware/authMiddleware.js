require('dotenv').config()
const apiKey = process.env.API_KEY;
const jwt = require("jsonwebtoken");
const helper = require("../controllers/helper");
const { access } = require('fs');
const { refreshToken } = require('firebase-admin/app');
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
		jwt.verify(access_token, process.env.ACCESS_TOKEN_SECRET, async(err, user) => {
			if (err) {
				console.log("checking token expired",user);
				// data = {email: user.email}
				// const deleted = await helper.deleteRecordsWithCondition(passwordResetTokenCollection, [data]);
				// if (deleted.status === "success") {
				// 	return res.status(403).json({ error: "Forbidden" });
				// }
				// return res.status(403).json({ error: "Forbidden check" });
			}

			// console.log(user);
			// req.email = user.email;
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


		const refreshToken = cookies.refreshToken;

		//select refresh token from db 
		const user = await helper.selectRecordsWithCondition(passwordResetTokenCollection, [{token: refreshToken}]);
		if (user.status === "success" ){
			const userToken = user.data[0].token;
			const email = user.data[0].email;

			//compare the token from the db with the token in the cookie to ensure they are the same token 
			userToken !== refreshToken && res.status(401).json({ error: "Unauthorized" });

			const query = `SELECT u.id AS user_id,u.first_name,u.last_name,u.employee_id,u.email,r.id AS role_id,r.name AS role_name FROM users u JOIN model_has_roles m ON u.id = m.model_id JOIN roles r ON r.id = m.role_id WHERE u.email = '${email}';`
				
			const userDetails = await helper.selectRecordsWithQuery(query);

			//verify the token here
			jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, async (err, user) => {
				if (err || user.email !== email) {
					console.log("checking refresh token expired",email);
					data = {email: email}
					const deleted = await helper.deleteRecordsWithCondition(passwordResetTokenCollection, [data]);
					if (deleted.status === "success") {
						return res.status(403).json({ error: "Forbidden" });
					}
				}

				//if user
				if(userDetails.status === "success"){
					accessToken = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "60m" });
					res.json({ accessToken,user: userDetails.data });
				}else{
					return res.status(403).json({ error: "Forbidden refresh" });
				}
			});
		}else{
			console.log("checking refresh token expired",user);
			res.status(403).json({ result: user.message, code: "403" });
		}
	} catch (error) {
		console.log(error);
		res.status(500).json({ error: "Internal Server Error" });
	}
	
}

module.exports = { checkApiKey, checkToken, handleRefreshToken };
