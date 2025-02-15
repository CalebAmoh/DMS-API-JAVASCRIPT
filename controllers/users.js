const { prisma } = require("../prismaConfig");
const helper = require("./helper");
const bcrypt = require("bcrypt"); //import bcrypt for hashing
const saltRounds = 10; //the number of time the password will be hashed with a unique salt{unique number}
const loggedInUsersCollection = "loggedInUsers";
const usersCollection = "users";
const pool = require("../mysqlconfig");

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
		const { employee,first_name,last_name,email,rank,phone,status,role,postedBy } = req.body;

		// Get a connection from the pool
        pool.getConnection((err, connection) => {
			if (err) {
			  console.error("Error getting connection from pool: ", err);
			  res.status(500).json({ message: "Database connection failed." });
			  return;
			}

			//check if user is already logged in
			const employeeCheckQuery = `SELECT * from users where id = ?;`

			connection.query(employeeCheckQuery, [employee], (err, result) => {
				if (err) {
					console.error("Error checking employee:", err);
					res.status(500).json({ result: "An error occurred, see logs for details", code: "500" });
					return;
				}

				if (result.length > 0) {
					res.status(400).json({ result: "user already registered", code: "400" });
					return;
				}
			});
		});

		
		

		//pass data entry into array
		const dataEntry = [
			{ name: "firstname", value: first_name },
			{ name: "last_name", value: last_name },
			{ name: "email", value: email },
			{ name: "phone", value: phone },
			{ name: "user role", value: role },
			{ name: "status", value: status },
			{ name: "posted by", value: postedBy },
		];

		//check for null or empty values from data entry
		const result = helper.checkForNullOrEmpty(dataEntry);

		//if check is successful hash the user password and insert data into database
		if (result.status === "success") {
			
			//check phone number uniqueness
			const isPhoneUnique = await helper.checkUniqueColumn("usersCollection", "phone",phone);
			if(isPhoneUnique.status === "error"){
				res.status(400).json({ result: isPhoneUnique.message, code: "400" });
				return;
			}

			//check email uniqueness
			const isEmailUnique = await helper.checkUniqueColumn("usersCollection", "email",email);
			if(isEmailUnique.status === "error"){
				res.status(400).json({ result: isEmailUnique.message, code: "400" });
				return;
			}

			const password = "pass1234"

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

			//insert user into the database

			const data = {
				employee_id: employee,
				first_name: first_name,
				last_name: last_name,
				email: email,
				password: hashedPassword,
			}
			const insertUser = await helper.dynamicInsert(usersCollection, data);

			if(insertUser.status === "error"){
				res.status(400).json({ result: insertUser.message, code: "400" });
				return;
			}else{
				res.status(200).json({ result: "User registered successfully", code: "200" });
			}
			
			
		} else {
			// console.log(result.message);
			res.status(400).json({ result: result.message, code: "400" });
		}
	} catch (error) {
		console.error("Error during registration:", error);

		res.status(500).json({
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

		//if check is successful get the user's encrypted password and compare
		//with the incoming one like shatta wale's track1
		if (result.status === "success") {
			//retrieve user with that email
			const userQuery = await prisma[usersCollection].findUnique({
				where: {
					email: email
				}
			});

			//if the user exist
			if (!userQuery) {
				res.status(400).json({ result: "no user found", code: "200" });
				return;
			}

			if (await helper.getObjectById(loggedInUsersCollection, userQuery.id)) {
				res.status(200).json({ result: "user already logged in", code: "200" });
				return;
			}

			//go ahead and authenticate the user
			//compare the incoming password to the password we have stored in the database
			const result = await bcrypt.compare(password, userQuery.password);
			if (result) {
				const isLoggedIn = await prisma[loggedInUsersCollection].create({
					data: {
						userId: userQuery.id
					}
				});

				if (!isLoggedIn) {
					res.status(400).json({
						result: "an error occured while logging please try again"
					});
					return;
				}

				res.status(200).json({
					result: "User authenticated successfully",
					user: {
						username: userQuery.username,
						user_role: userQuery.userRole,
						user_id: userQuery.id
					},
					code: "200"
				});
			} else {
				res.status(400).json({
					result: "Password or email is incorrect",
					code: "400"
				});
				return;
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

//handles getting all users
const getUsers = async (req, res) => {
	try {
		// Get the user making the request
		const userId = req.params.user_id;

		// Check if the user is already logged in
		if (!await helper.isAuthUser(userId)) {
			res.status(400).json({ result: "Unauthenticated User", code: "400" });
			return;
		}

		// Pass data entry into an array
		const dataEntry = [{ name: "posted by", value: userId }];

		// Check for null or empty values from data entry
		const result = helper.checkForNullOrEmpty(dataEntry);

		// If check is successful, retrieve users from the database
		if (result.status === "success") {
			// Retrieve users from the database
			const allUsers = await prisma[usersCollection].findMany();

			// Log the retrieved users
			console.log("All users:", allUsers);

			// Send the response with the retrieved users
			res.status(200).json({
				result: "All Users retrieved",
				users: allUsers,
				code: "200"
			});
		} else {
			res.status(400).json({ result: result.message, code: "400" });
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

//checks for unique email
const checkForUniqueEmail = async email => {
	try {
		//if the collection does not exist return true

		// if (await helper.isCollectionEmpty(usersCollection)) {
		// 	return true;
		// }

		const isemailUnique = await prisma.users.findUnique({
			where: {
				email: email
			}
		});

		if (isemailUnique) {
			return false;
		} else {
			return true;
		}
	} catch (error) {
		console.error("Error checking email uniqueness:", error);
		throw error; // Propagate the error to the caller
	}
};

//checks for unique phone
const checkForUniquePhone = async phone => {
	try {
		const isPhoneUnique = await prisma[usersCollection].findUnique({
			where: {
				phone: phone
			}
		});

		if (isPhoneUnique) {
			return false;
		} else {
			return true;
		}
	} catch (error) {
		console.error("Error checking phone uniqueness:", error);
		throw error; // Propagate the error to the caller
	}
};



module.exports = {
	register,
	login,
	getUsers,
	deleteUser,
	logoutUser,
	updateUser,
	changeUserPassword,
	getUser
	// other controller functions if any
};
