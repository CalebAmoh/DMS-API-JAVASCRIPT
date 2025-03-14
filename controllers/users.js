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
	* logout() - to unauthenticate a user,
	* getUsers() - to get all users in the app,
	* getUser() - get a single user
	* deactivateUser() - to deactivate a user,
	* updateUser() - to change the details of a user,
	* changeUserPassword() -  to reset user password
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
			const userId = getUser.data[0].id;

			const getRole = await helper.selectRecordsWithCondition(rolesCollection,[{name: role}]);
			const roleId = getRole.data[0].id;

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
		console.log(req.body);
		//pass data entry into array
		const dataEntry = [
			{ name: "email", value: email },
			{ name: "password", value: password }
		];

		//check for null or empty values from data entry
		const result = helper.checkForNullOrEmpty(dataEntry);

		//if check is successful get the user's encrypted password and compare with the incoming password
		if (result.status === "success") {
			data = {email: email}
			console.log("im now entering")
			const deleted = await helper.deleteRecordsWithCondition(passwordResetTokenCollection, [data]);
			if (deleted.status === "success") {
				console.log("Token deleted successfully");
			}else{
				//delete failed
				console.log("watsup",deleted.message);
				// res.status(500).json({ error: "Internal Server Error" });
			}

			//retrieve user with that email
			const userQuery = await helper.selectRecordsWithCondition(usersCollection, [{ email: email }]);
			if (userQuery.status === "success") {
				const userPassowrd = userQuery.data[0].password;

				//check if the password is correct
				const result = await bcrypt.compare(password, userPassowrd);
				if (result) {

					const query = `SELECT u.id AS user_id,u.first_name,u.last_name,u.employee_id,u.email,r.id AS role_id,r.name AS role_name FROM users u JOIN model_has_roles m ON u.id = m.model_id JOIN roles r ON r.id = m.role_id WHERE u.email = '${email}';`

					const userDetails = await helper.selectRecordsWithQuery(query);

					if(userDetails.status === "success"){

						//generate token
						const accessToken = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "10s" });
						const refreshToken = jwt.sign({ email: email }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: "60m" });

						//save the token in the database
						const data = {
							email: userQuery.data[0].email,
							token: refreshToken
						};

						const insertToken = await helper.dynamicInsert(passwordResetTokenCollection, data);

						if(insertToken.status === "success") {
							console.log("Token inserted successfully",userDetails);
							res.cookie("refreshToken", refreshToken, { httpOnly: true , sameSite:'None',secure:true, maxAge: 24*60*60*1000});
							res.status(200).json({
								result: "User authenticated successfully",
								user: userDetails.data,
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
			// res.sendStatus(403)
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

//get a single user
const getUser = async (req, res) => {
	try {
		
			query = `SELECT CONCAT(users.first_name, ' ', users.last_name) AS employee, users.*, model_has_roles.role_id AS role,roles.name AS role_name FROM users JOIN model_has_roles ON users.id = model_has_roles.model_id JOIN roles ON model_has_roles.role_id = roles.id WHERE users.id = ? LIMIT 1`;
			
			//check for null or empty values from data entry
			const result = await helper.selectRecordsWithQuery(query, [req.params.userId]);

			if (result.status === "success") {
				res.status(200).json({ result: result.data, code: "200" });
			}else{
				res.status(404).json({ result: result.message, code: "404" });	
			}

	} catch (error) {
		console.error("Unexpected Error", error);
		res.status(500).json({
			result: "An error occurred, see logs for details",
			code: "500"
		});
	}
};

//delete user
const deactivateUser = async (req, res) => {
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

//update user
const updateUser = async(req,res) =>{
	try{
		// Access and validate data from the request body
		const { employee_id, first_name, last_name, email, rank, phone, status, role, posted_by } = req.body;

		// Pass data entry into array
		const dataEntry = [
			// { name: "employee id", value: employee_id },
			// { name: "firstname", value: first_name },
			// { name: "last name", value: last_name },
			// { name: "email", value: email },
			// { name: "phone", value: phone },
			{ name: "user role", value: role },
			{ name: "status", value: status },
			{ name: "posted by", value: posted_by },
		];

		// Check for null or empty values from data entry
		const result = helper.checkForNullOrEmpty(dataEntry);

		if(result.status === "success"){
			const data = {
				employee_id,
				first_name,
				last_name,
				posted_by,
				status
			};

			const updateUser = await helper.dynamicUpdateWithId(usersCollection,data,req.params.userId);

			if(updateUser.status === "success"){
				// update user role
				const getRole = await helper.selectRecordsWithCondition(rolesCollection,[{name: role}]);
				const roleId = getRole.data[0].id;

				//role data
				const roleData = {
					role_id: roleId,
					model_id: req.params.userId,
					"model_type":"App\Models\User"
				};

				const roleUpdate = await helper.dynamicUpdateWithId("model_has_roles", roleData,req.params.userId,"model_id");

				if(roleUpdate.status === "success"){
					res.status(200).json({ result: "User updated successfully", code: "200" });
				}else{
					res.status(203).json({result:roleUpdate.message, code:"203"});
				}
			}else{
				console.log("Error updating user:", updateUser.message);
				return res.status(400).json({ result: "An error occurred, see logs for details", code: "400" });
			}
		}else{
			res.status(400).json({ result: result.message, code: "400" });
		}

	}catch(error){
		console.error("Error updating user", error);
		res.status(500).json({ result: "An error occurred, see logs for details", code: "500" });
	}
}

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
	updateUser,
	// deleteUser,
	logout,
	getUser,
	getUserRoles
	// other controller functions if any
};
