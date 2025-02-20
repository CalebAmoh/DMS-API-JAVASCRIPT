const { prisma } = require("../prismaConfig");
const helper = require("./helper");
const bcrypt = require("bcrypt"); //import bcrypt for hashing
const saltRounds = 10; //the number of time the password will be hashed with a unique salt{unique number}
const loggedInUsersCollection = "loggedInUsers";
const usersCollection = "users";
const rolesCollection = "roles";
const passwordResetTokenCollection = "password_reset_tokens";
const pool = require("../mysqlconfig");
const jwt = require("jsonwebtoken");
const { refreshToken } = require("firebase-admin/app");
require("dotenv").config();

/***********************************************************************************************************
 * usercontroller handles all user creation and authentication and any other user-related activity in the app
 * 
 * Activities include {
	* register() - to add new users,
	* login() - to authenticate user,
	* getUsers() - to get all users in the app,
	* deleteUser() - to delete a user,
	* logoutUser() - to unauthenticate a user,
	* updateUser() - to change the details of a user,
	* changeUserPassword() -  to reset user password
	* getUser() - get a single user
	* checkForUniqueEmail() - handles the checking of unique passwords
	* checkForUniquePhone() -  handles the checking of unique phone numbers
 * }
 * 
 ***************************************************************************************************************/

//handles the registration of users in the system
const register = async (req, res) => {
	try {
		// Access and validate data from the request body
		const { employee_id, first_name, last_name, email, rank, phone, status, role, posted_by } = req.body;

		console.log(req.body);

		// Pass data entry into array
		const dataEntry = [
			{ name: "employee id", value: employee_id },
			{ name: "firstname", value: first_name },
			{ name: "last name", value: last_name },
			{ name: "email", value: email },
			// { name: "phone", value: phone },
			{ name: "user role", value: role },
			{ name: "status", value: status },
			{ name: "posted by", value: posted_by },
		];

		// Check for null or empty values from data entry
		const result = helper.checkForNullOrEmpty(dataEntry);

		if (result.status !== "success") {
			return res.status(203).json({ result: result.message, code: "203" });
		}

		
		// Check for unique values
		const isUnique = await helper.checkUniqueColumn(usersCollection, [{"phone":phone},{"email": email}, {"employee_id": employee_id}]);
		console.log("isUnique", isUnique.message);
		if (isUnique.status === "error") {
			return res.status(409).json({ result: isUnique.message, code: "409" });
		}


		const password = "pass1234";

		// Encrypt password
		const hashedPassword = await new Promise((resolve, reject) => {
			bcrypt.hash(password, saltRounds, (err, hash) => {
				if (err) reject(err);
				else resolve(hash);
			});
		});

		// Insert user into the database
		const data = {
			employee_id,
			first_name,
			last_name,
			phone,
			email,
			password: hashedPassword,
			posted_by,
			status
		};

		const insertUser = await helper.dynamicInsert(usersCollection, data);

		if(insertUser.status === "success") {
			// Insert user role into the database
			const getUser = await helper.selectRecordsWithCondition(usersCollection, [{ email: email }]);
			const userId = getUser.message[0].id;

			const getRole = await helper.selectRecordsWithCondition(rolesCollection,[{name: role}]);
			const roleId = getRole.message[0].id;

			//role data
			const roleData = {
				role_id: roleId,
				model_id: userId,
				"model_type":"App\Models\User"
			};

			const insertUserRole = await helper.dynamicInsert("model_has_roles", roleData);

			if(insertUserRole.status === "success"){
				 res.status(200).json({ result: "User registered successfully", code: "200" });
			}else{
				res.status(203).json({result:insertUserRole.message, code:"203"});
			}

		}else{
			console.log("Error inserting user:", insertUser.message);
			return res.status(400).json({ result: "An error occurred, see logs for details", code: "400" });
		}

	} catch (error) {
		console.error("Error during registration:", error);
		return res.status(500).json({
			result: "An error occurred, see logs for details",
			code: "500"
		});
	}
};

//handles the authentication of users of the system
const login = async (req, res) => {
	try {
		// Access data from the request body
		const { email, password } = req.body;

		//pass data entry into array
		const dataEntry = [
			{ name: "email", value: email },
			{ name: "password", value: password }
		];

		//check for null or empty values from data entry
		const result = helper.checkForNullOrEmpty(dataEntry);

		//if check is successful get the user's encrypted password and compare with the incoming password
		if (result.status === "success") {
			//retrieve user with that email
			const userQuery = await helper.selectRecordsWithCondition(usersCollection, [{ email: email }]);
			if (userQuery.status === "success") {
				const userPassowrd = userQuery.message[0].password;

				//check if the password is correct
				const result = await bcrypt.compare(password, userPassowrd);
				if (result) {

					//generate token
					const accessToken = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "15m" });
					const refreshToken = jwt.sign({ email: email }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: "1h" });

					//save the token in the database
					const data = {
						email: userQuery.message[0].email,
						token: refreshToken
					};

					const insertToken = await helper.dynamicInsert(passwordResetTokenCollection, data);

					if(insertToken.status === "success") {
						console.log("Token inserted successfully");
						res.cookie("refreshToken", refreshToken, { httpOnly: true , sameSite:'None',secure:true, maxAge: 24*60*60*1000});
						res.status(200).json({
							result: "User authenticated successfully",
							user: userQuery.message,
							accessToken: accessToken,
							code: "200"
						});
					}else{
						console.log("Error inserting token:", insertToken.message);
						res.status(400).json({
							result: "An error occurred, see logs for details",
							code: "400"
						});
					}
				} else {
					res.status(401).json({
						result: "Password or email is incorrect",
						code: "401"
					});
				}
			}else{
				res.status(401).json({ result: userQuery.message, code: "401" });
			}


		} else {
			res.status(400).json({ result: result.message, code: "400" });
		}
	} catch (error) {
		console.error("fuck this shit never want to come here", error);
		res.status(500).json({
			result: "An error occurred, see logs for details",
			code: "500"
		});
	}
};

const logout = async (req, res) => {
	try {
		const cookies = req.cookies;
		!cookies?.refreshToken && res.status(401).json({ error: "No Content" });

		const refreshToken = cookies.refreshToken;

		//select refresh token from db 
		data = {token: refreshToken}
		const user = await helper.selectRecordsWithCondition(passwordResetTokenCollection, [data]);
		if (user.status === "success" ){
			//delete the refresh token from db
			const deleted = await helper.deleteRecordsWithCondition(passwordResetTokenCollection, [data]);
			if (deleted.status === "success") {
				res.clearCookie("refreshToken",{httpOnly:true,sameSite:'None',secure:true});
				res.status(200).json({ status: "success", message: "User logged out successfully" });
			}else{
				//delete failed
				console.log(deleted.message);
				res.status(500).json({ error: "Internal Server Error" });
			}

		}else{
			console.log(user.message);
			res.clearCookie("refreshToken",{httpOnly:true,sameSite:'None',secure:true});
			res.sendStatus(403)
			// .json({ result: user.message, code: "403" });
		}
	} catch (error) {
		console.log(error);
		res.status(400).json({ error: "Internal Server Error"})
	}
}

//handles getting all users
const getUsers = async (req, res) => {
	try {
		// Query to get all users with their roles and formatted status
		const query = `
			SELECT u.*, r.name as role,
				CASE 
					WHEN u.status = 1 THEN 'Active'
					WHEN u.status = 0 THEN 'Inactive'
					ELSE u.status 
				END as status
			FROM users u
			JOIN model_has_roles mhr ON u.id = mhr.model_id
			JOIN roles r ON mhr.role_id = r.id`;

	    //get records
		const users = await helper.selectRecordsWithQuery(query);
		if(users.status === "success"){
			res.status(200).json({results:users.data, code:"200"});
		}else{
			console.log("Error retrieving users:", users.message);
			res.status(400).json({result:users.message, code:"400"});
		}
		
	} catch (error) {
		console.error("Error retrieving users:", error);
		res.status(500).json({ result: "Internal server error", code: "500" });
	}
};

//delete user
const deleteUser = async (req, res) => {
	try {
		const user = req.body.user_id;
		const deletedBy = req.body.deleted_by;

		//check if user is already logged in
		if (!await helper.isAuthUser(deletedBy)) {
			res.status(400).json({ result: "Unauthenticated User", code: "400" });
			return;
		}

		//pass data entry into array
		const dataEntry = [
			{ name: "user", value: user },
			{ name: "deleted by", value: deletedBy }
		];

		//check for null or empty values from data entry
		const result = helper.checkForNullOrEmpty(dataEntry);

		//if check is successful delete the user
		if (result.status === "success") {
			//check if user to be deleted is actually a registered user
			if (!await helper.getObjectById(usersCollection, user)) {
				res.status(200).json({ result: "no user found", code: "200" });
				return;
			}

			const deleteUser = await prisma[usersCollection].delete({
				where: {
					id: user
				}
			});

			console.log(deleteUser);

			if (deleteUser) {
				//check the loggedInUsers table to see if the user being deleted is logged in and log the user out
				if (await helper.getObjectById(loggedInUsersCollection, deleteUser.id)) {
					const deleteAuthUser = await prisma[loggedInUsersCollection].delete({
						where: {
							userId: deleteUser.id
						}
					});
				}

				res.status(200).json({ result: "User deleted", code: "200" });
			}
		} else {
			res.status(400).json({ result: result.message, code: "400" });
		}
	} catch (error) {
		console.error("fuck this shit never want to come here", error);
		res.status(500).json({
			result: "An error occurred, see logs for details",
			code: "500"
		});
	}
};

//logout user REMINDER: IF USER IS LOGGING OUT CHECK TO SEE IF HE EVER LOGGED IN1
const logoutUser = async (req, res) => {
	const user = req.body.user_id;

	//pass data entry into array
	const dataEntry = [{ name: "user", value: user }];

	//check for null or empty values from data entry
	const result = helper.checkForNullOrEmpty(dataEntry);

	//if check is successful logout the user
	if (result.status === "success") {
		try {
			

			// Check if documents exist before attempting to delete
			if (!await helper.getObjectById(loggedInUsersCollection, user)) {
				res.status(400).json({ result: "user never logged in", code: "400" });
				return;
			}

			//delete logged in user
			const deleteUser = await prisma[loggedInUsersCollection].delete({
				where: {
					userId: user
				}
			});

			// Check if the delete operation was successful
			if (Object.keys(deleteUser).length !== 0) {
				// The delete operation was successful
				res.status(200).json({
					result: "User logged out successfully",
					code: "200"
				});
			} else {
				// The delete operation failed
				res.status(400).json({
					result: "User logged out failed",
					code: "400"
				});
			}
		} catch (error) {
			console.error("Error deleting documents:", error);
			res.status(500).json({
				result: "An error occurred",
				code: "500"
			});
		}
	} else {
		res.status(400).json({ result: result.message, code: "400" });
	}
};

//update user
const updateUser = async (req, res) => {
	try {
		const { username, email, phone, userRole, userId, postedBy } = req.body;

		//pass data entry into array
		const dataEntry = [
			{ name: "user", value: userId },
			{ name: "posted by", value: postedBy },
			{ name: "username", value: username },
			{ name: "email", value: email },
			{ name: "user role", value: userRole },
			{ name: "phone", value: phone }
		];

		//check for null or empty values from data entry
		const result = helper.checkForNullOrEmpty(dataEntry);

		//if check is successful update the user
		if (result.status === "success") {
			// Check if the user is already logged in
			if (!await helper.isAuthUser(postedBy)) {
				res.status(400).json({ result: "Unauthenticated User", code: "400" });
				return;
			}

			// Check if documents exist before attempting to update
			console.log("wait",await helper.getObjectById(usersCollection, userId));
			if (!await helper.getObjectById(usersCollection, userId)) {
				res.status(400).json({ result: "user not found", code: "400" });
				return;
			}

			// Update user fields in the database
			const updateUser = await prisma[usersCollection].update({
				where: {
					id: userId
				},
				data: {
					username: username,
					email: email,
					phone: phone,
					userRole: userRole
				}
			});

			// Check if the update operation was successful
			if (Object.keys(updateUser).length !== 0) {
				// The delete operation was successful
				res.status(200).json({
					result: "User updated successfully",
					code: "200"
				});
			} else {
				// The delete operation failed
				res.status(400).json({
					result: "User update failed",
					code: "400"
				});
			}
		} else {
			res.status(400).json({ result: result.message, code: "400" });
		}
	} catch (error) {
		console.log(error);
		res
			.status(500)
			.json({ result: "An error occurred contact admin", code: "500" });
	}
};

//change user password
const changeUserPassword = async (req, res) => {
	try {
		const password = req.body.password;
		const userId = req.body.user_id;
		const postedBy = req.body.postedBy;

		// Check if the user is already logged in
		if (!await helper.isAuthUser(postedBy)) {
			res.status(400).json({ result: "Unauthenticated User", code: "400" });
			return;
		}

		//pass data entry into array
		const dataEntry = [
			{ name: "user", value: userId },
			{ name: "posted by", value: postedBy },
			{ name: "password", value: password }
		];

		//check for null or empty values from data entry
		const result = helper.checkForNullOrEmpty(dataEntry);

		//if check is successful update the user
		if (result.status === "success") {
			// Check if documents exist before attempting to update password
			if (!await helper.getObjectById(usersCollection, userId)) {
				res.status(400).json({ result: "user not found", code: "400" });
				return;
			}

			//encrypt password before you save in the database
			const hashedPassword = await new Promise((resolve, reject) => {
				bcrypt.hash(password, saltRounds, (err, hash) => {
					if (err) {
						reject(err);
					} else {
						resolve(hash);
					}
				});
			});

			// Update user fields in the database
			const updateUserPassword = await prisma[usersCollection].update({
				where: {
					id: userId
				},
				data: {
					password: hashedPassword
				}
			});

			// Check if the update operation was successful
			if (Object.keys(updateUserPassword).length !== 0) {
				res.status(200).json({
					result: "User password changed successfully",
					code: "200"
				});
			} else {
				// The delete operation failed
				res.status(400).json({
					result: "User password change failed",
					code: "400"
				});
			}
		} else {
			res.status(400).json({ result: result.message, code: "400" });
		}
	} catch (error) {
		console.log(error);
		res
			.status(500)
			.json({ result: "An error occurred contact admin", code: "500" });
	}
};

//get a single user
const getUser = async (req, res) => {
	try {
		//get data from request
		const { userId, requestedBy } = req.body;

		//structure the data for validation
		dataEntry = [
			{ name: "user id", value: userId },
			{ name: "requested by", value: requestedBy }
		];

		//check for null or empty values from data entry
		const result = helper.checkForNullOrEmpty(dataEntry);

		if (result.status !== "success") {
			res.status(400).json({ result: result.message, code: "400" });
			return;
		}

		// Check if the user is already logged in
		if (!await helper.isAuthUser(requestedBy)) {
			res.status(400).json({ result: "Unauthenticated User", code: "400" });
			return;
		}

		// Check if documents exist before attempting to delete
		if (!await helper.getObjectById(usersCollection, userId)) {
			res.status(400).json({ result: "user not found", code: "400" });
			return;
		}

		const user = await prisma[usersCollection].findUnique({
			where: {
				id: userId
			}
		});

		// Check if the update operation was successful
		if (Object.keys(user).length !== 0) {
			res.status(200).json({
				result: {
					user: {
						username: user.username,
						userRole: user.userRole,
						phone: user.phone,
						email: user.email
					}
				},
				code: "200"
			});
		} else {
			// The delete operation failed
			res.status(400).json({
				result: "User not found",
				code: "400"
			});
		}
	} catch (error) {
		console.error("fuck this shit never want to come here", error);
		res.status(500).json({
			result: "An error occurred, see logs for details",
			code: "500"
		});
	}
};

//get all user roles
const getUserRoles = async (req, res) => {
	try {
		const query = `select * from roles`;
		const roles = await helper.selectRecordsWithQuery(query);

		if(roles.message = "success"){
			res.status(200).json({results:roles.data, code:"200"});
		}else{
			res.status(203).json({results:roles.message, code:"203"});
		}
	} catch (error) {
		console.log(error);
		res.status(500).json({results:"An error occurred check logs", code:"500"})
	}
}





module.exports = {
	register,
	login,
	logout,
	getUsers,
	deleteUser,
	logoutUser,
	updateUser,
	changeUserPassword,
	getUser,
	getUserRoles
	// other controller functions if any
};
