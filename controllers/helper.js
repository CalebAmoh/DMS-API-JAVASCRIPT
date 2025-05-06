const loggedInUsersCollection = "loggedInUsers"; //logged in users collection
const newsCollection = "news"; //news collection to hold news
const usersCollection = "users"; //users collection to hold users
const messageCollection = "messages"; //holds static message
const { prisma } = require("../prismaConfig");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const MongoClient = require("mongodb").MongoClient;
const axios = require("axios");
const pool = require("../mysqlconfig");
const { table } = require("console");

/***********************************************************************************************************
 * helper functions, these are functions that makes my work soft like brezz 
 * 
 * It includes helper functions such as:
 * - checkForNullOrEmpty: validating null or empty data being passed in user request
 * - isAuthUser: checking users who are logged in or not, if user is logged in return true else false
 * - isCollectionEmpty: checking if a collection is empty (this function helps in checking for unique emails and users logged in) 
 * - uploadFile: this helper function helps with the upload of multiple files at a go making my code run faster than usain bolt
 * - deleteFile: this helper function helps with the deletion of files at a go making my code run faster than auntie mercy
 * - getObjectById() - handles the checking of an object in any collection params collection, object id
 * - fetchData() - handles the fetching of data from different sources at a go (same time)
 * - dynamicInsert() - handles the insertion of data into any specified MySQL table
 ***************************************************************************************************************/

//check for null variables and returns a message with the null value
function checkForNullOrEmpty(data) {
	const nullVariables = data.filter(({ value }) => value === null);
	const undefinedVariables = data.filter(({ value }) => value === undefined);
	const emptyStringVariables = data.filter(({ value }) => value === "");
	const whitespaceStringVariables = data.filter(
		({ value }) => typeof value === "string" && value.trim() === ""
	);

	if (
		nullVariables.length > 0 ||
		undefinedVariables.length > 0 ||
		emptyStringVariables.length > 0 ||
		whitespaceStringVariables.length > 0
	) {
		const nullErrorMessage = nullVariables
			.map(({ name }) => `${name} cannot be null`)
			.join(", ");
		const undefinedErrorMessage = undefinedVariables
			.map(({ name }) => `${name} cannot be undefined`)
			.join(", ");
		const emptyStringErrorMessage = emptyStringVariables
			.map(({ name }) => `${name} cannot be empty`)
			.join(", ");
		const whitespaceStringErrorMessage = whitespaceStringVariables
			.map(({ name }) => `${name} cannot be whitespace only`)
			.join(", ");

		const errorMessage = `${nullErrorMessage}${nullErrorMessage &&
		(undefinedErrorMessage ||
			emptyStringErrorMessage ||
			whitespaceStringErrorMessage)
			? ", "
			: ""}${undefinedErrorMessage}${undefinedErrorMessage &&
		(emptyStringErrorMessage || whitespaceStringErrorMessage)
			? ", "
			: ""}${emptyStringErrorMessage}${emptyStringErrorMessage &&
		whitespaceStringErrorMessage
			? ", "
			: ""}${whitespaceStringErrorMessage}`;

		return {
			status: "error",
			message: `Null, undefined, empty, or whitespace-only variables found: ${errorMessage}`,
			values: nullVariables.concat(
				undefinedVariables,
				emptyStringVariables,
				whitespaceStringVariables
			)
		};
	} else {
		return {
			status: "success",
			message:
				"No null, undefined, empty, or whitespace-only variables, operation successful"
		};
	}
}

/**
 * Checks if a value or combination of values exists in specified columns of a MySQL table
 * @param {string} tableName - Name of the table to check
 * @param {Object|Array} columns - Either an object with column-value pairs or array of {column, value} objects
 * @returns {Promise<Object>} Object containing status and message
 */
const checkUniqueColumn = async (tableName, columns) => {
	try {
		// Handle both single column-value pair and multiple columns
		const columnData = Array.isArray(columns) ? columns : [{ column: Object.keys(columns)[0], value: Object.values(columns)[0] }];
		
		// Build WHERE clause for the query
		const whereConditions = columnData.map(col => `${Object.keys(col)[0]} = ?`).join(' OR ');
		const values = columnData.map(col => Object.values(col)[0]);
		
		// First, get the duplicate records to show which fields match
		const selectColumns = columnData.map(col => Object.keys(col)[0]).join(', ');
		const duplicateQuery = `SELECT ${selectColumns} FROM ${tableName} WHERE ${whereConditions}`;

		return new Promise((resolve, reject) => {
			pool.getConnection((err, connection) => {
				if (err) {
					console.error("Error getting connection from pool:", err);
					reject({
						status: "error",
						message: "Database connection failed"
					});
					return;
				}

				connection.query(duplicateQuery, values, (err, duplicates) => {
					if (err) {
						connection.release();
						console.error("Error executing query:", err);
						reject({
							status: "error",
							message: "Failed to check unique value"
						});
						return;
					}

					if (duplicates.length === 0) {
						connection.release();
						resolve({
							status: "success",
							message: "Value is unique"
						});
					} else {
						// Create detailed error message showing which fields matched with existing records
						const duplicateDetails = duplicates.map(record => {
							const matchedFields = columnData
								.map(col => {
									const colName = Object.keys(col)[0];
									const inputValue = Object.values(col)[0];
									if (record[colName] === inputValue) {
										return `${colName}: "${inputValue}"`;
									}
									return null;
								})
								.filter(Boolean)
								.join(', ');
							return matchedFields;
						});

						connection.release();
						resolve({
							status: "error",
							message: `Found duplicate entries in ${tableName} matching: ${duplicateDetails.join(' OR ')}`,
							duplicates: duplicates
						});
					}
				});
			});
		});
	} catch (error) {
		console.error("Error checking unique column:", error);
		throw error;
	}
};


/**
 * Select data from MySQL table
 * @param {string} tableName - Name of the table to check
 * @param {Object|Array} columns - Either an object with column-value pairs or array of {column, value} objects
 * @returns {Promise<Object>} Object containing status and message
 */
const selectRecordsWithCondition = async (tableName, columns) => {
	try {
		// Handle both single column-value pair and multiple columns
		const columnData = Array.isArray(columns) ? columns : [{ column: Object.keys(columns)[0], value: Object.values(columns)[0] }];
		
		// Build WHERE clause for the query
		const whereConditions = columnData.map(col => `${Object.keys(col)[0]} = ?`).join(' OR ');
		const values = columnData.map(col => Object.values(col)[0]);
		
		console.log("whereConditions", whereConditions);
		console.log("values", values);
		
		// First, get the duplicate records to show which fields match
		const records = `SELECT * FROM ${tableName} WHERE ${whereConditions}`;

		return new Promise((resolve, reject) => {
			pool.getConnection((err, connection) => {
				if (err) {
					console.error("Error getting connection from pool:", err);
					reject({
						status: "error",
						message: "Database connection failed",
						data:[]
					});
					return;
				}

				connection.query(records, values, (err, data) => {
					if (err) {
						connection.release();
						console.error("Error executing query:", err);
						reject({
							status: "error",
							message: "Failed to check unique value",
							data:[]
						});
						return;
					}

					if (data.length === 0) {
						connection.release();
						resolve({
							status: "error",
							message: "No data found",
							data:[]
						});
					} else {

						connection.release();
						resolve({
							status: "success",
							data: data
						});
					}
				});
			});
		});
	} catch (error) {
		console.error("Error checking unique column:", error);
		throw error;
	}
};

//checks for already logged in users {if user is logged in return true else false}
const isAuthUser = async userId => {
	try {
		//check collection if the user is logged in
		const user = await prisma[loggedInUsersCollection].findUnique({
			where: {
				userId: userId
			}
		});

		// console.log("user ni nie", user.userId);
		if (user) {
			return true;
		} else {
			return false;
		}
	} catch (error) {
		console.error("Error checking if user is logged in:", error);
		// res.status(500).json({
		// 	result: "An error occurred, see logs for details",
		// 	code: "500"
		// }); // Propagate the error to the caller
	}
};


/**
 * Dynamically inserts data into any specified MySQL table
 * @param {string} tableName - Name of the table to insert into
 * @param {Object} data - Data object to be inserted
 * @returns {Promise<Object>} The created record
 */
async function dynamicInsert(tableName, data) {
	try {
		// Create the SQL query dynamically
		const columns = Object.keys(data).join(', ');
		const placeholders = Object.keys(data).map(() => '?').join(', ');
		const values = Object.values(data);
		
		const query = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`;

		return new Promise((resolve, reject) => {
			pool.getConnection((err, connection) => {
				if (err) {
					console.error("Error getting connection from pool:", err);
					reject({
						status: "error",
						message: "Database connection failed",
						error: err
					});
					return;
				}

				connection.query(query, values, (err, result) => {
					connection.release(); // Always release the connection

					if (err) {
						console.error(`Error inserting into ${tableName}:`, err);
						reject({
							status: "error",
							message: `Failed to insert data: ${err.message}`,
							error: err
						});
						return;
					}

					// Return the inserted data along with the new ID
					resolve({
						status: "success",
						message: "Data inserted successfully",
						data: {
							id: result.insertId,
							...data
						}
					});
				});
			});
		});

	} catch (error) {
		console.error(`Error in dynamicInsert for ${tableName}:`, error);
		throw {
			status: "error",
			message: `Failed to insert data: ${error.message}`,
			error: error
		};
	}
}

/**
 * Dynamically updates data in any specified MySQL table by ID
 * @param {string} tableName - Name of the table to update
 * @param {Object} data - Data object containing fields to be updated
 * @param {number|string} id - ID of the record to update
 * @param {string} idColumn - Name of the ID column (defaults to 'id')
 * @returns {Promise<Object>} Result of the update operation
 */
async function dynamicUpdateWithId(tableName, data, id, idColumn = 'id') {
	try {
		// Create SET clause for the update query
		const setClause = Object.keys(data)
			.map(key => `${key} = ?`)
			.join(', ');
		
		// Values for the prepared statement (all data values followed by the ID)
		const values = [...Object.values(data), id];
		
		// Construct the UPDATE query
		const query = `UPDATE ${tableName} SET ${setClause} WHERE ${idColumn} = ?`;

		return new Promise((resolve, reject) => {
			pool.getConnection((err, connection) => {
				if (err) {
					console.error("Error getting connection from pool:", err);
					reject({
						status: "error",
						message: "Database connection failed",
						error: err
					});
					return;
				}

				connection.query(query, values, (err, result) => {
					connection.release(); // Always release the connection

					if (err) {
						console.error(`Error updating ${tableName}:`, err);
						reject({
							status: "error",
							message: `Failed to update data: ${err.message}`,
							error: err
						});
						return;
					}

					if (result.affectedRows === 0) {
						resolve({
							status: "error",
							message: `No record found with ${idColumn} = ${id}`,
							affectedRows: 0
						});
					} else {
						resolve({
							status: "success",
							message: "Data updated successfully",
							affectedRows: result.affectedRows,
							data: {
								[idColumn]: id,
								...data
							}
						});
					}
				});
			});
		});
	} catch (error) {
		console.error(`Error in dynamicUpdateWithId for ${tableName}:`, error);
		throw {
			status: "error",
			message: `Failed to update data: ${error.message}`,
			error: error
		};
	}
}

/**
 * Delete records from MySQL table based on conditions.
 * @param {string} tableName - Name of the table to delete from
 * @param {Object|Array} conditions - Either an object with column-value pairs or array of {column, value} objects
 * @returns {Promise<Object>} Object containing status, message and count of deleted records
 */
const deleteRecordsWithCondition = async (tableName, conditions) => {
	try {
		// Handle both single condition-value pair and multiple conditions
		const conditionData = Array.isArray(conditions) ? conditions : [{ column: Object.keys(conditions)[0], value: Object.values(conditions)[0] }];
		
		// Build WHERE clause for the query
		const whereConditions = conditionData.map(col => `${Object.keys(col)[0]} = ?`).join(' AND ');
		const values = conditionData.map(col => Object.values(col)[0]);
		
		// Construct DELETE query
		const deleteQuery = `DELETE FROM ${tableName} WHERE ${whereConditions}`;

		return new Promise((resolve, reject) => {
			pool.getConnection((err, connection) => {
				if (err) {
					console.error("Error getting connection from pool:", err);
					reject({
						status: "error",
						message: "Database connection failed"
					});
					return;
				}

				connection.query(deleteQuery, values, (err, result) => {
					connection.release();

					if (err) {
						console.error("Error executing delete query:", err);
						reject({
							status: "error",
							message: "Failed to delete records",
							error: err.message
						});
						return;
					}

					if (result.affectedRows === 0) {
						resolve({
							status: "error",
							message: "No matching records found to delete",
							deletedCount: 0
						});
					} else {
						resolve({
							status: "success",
							message: `Successfully deleted ${result.affectedRows} record(s)`,
							deletedCount: result.affectedRows
						});
					}
				});
			});
		});
	} catch (error) {
		console.error("Error in deleteRecordsWithCondition:", error);
		throw error;
	}
};

/**
 * Execute a custom SELECT query and return the results
 * @param {string} query - The SQL query to execute
 * @param {Array} params - Array of parameter values for the query (optional)
 * @returns {Promise<Object>} Object containing status, message and the retrieved records
 */
const selectRecordsWithQuery = async (query, params = []) => {
	try {
		return new Promise((resolve, reject) => {
			pool.getConnection((err, connection) => {
				if (err) {
					console.error("Error getting connection from pool:", err);
					reject({
						status: "error",
						message: "Database connection failed",
						error: err.message
					});
					return;
				}

				connection.query(query, params, (err, results) => {
					connection.release();

					if (err) {
						console.error("Error executing select query:", err);
						reject({
							status: "error",
							message: "Failed to execute query",
							error: err.message,
							data:[]
						});
						return;
					}

					if (results.length === 0) {
						resolve({
							status: "success",
							message: "No records found",
							data: []
						});
					} else {
						resolve({
							status: "success",
							message: "Records retrieved successfully",
							data: results,
							count: results.length
						});
					}
				});
			});
		});
	} catch (error) {
		console.error("Error in selectRecordsWithQuery:", error);
		throw {
			status: "error",
			message: "Failed to execute query",
			error: error.message
		};
	}
};

module.exports = {
	checkForNullOrEmpty,
	checkUniqueColumn,
	isAuthUser,
	selectRecordsWithCondition,
	deleteRecordsWithCondition,
	dynamicInsert,
	selectRecordsWithQuery,
	dynamicUpdateWithId
	// other controller functions if any
};
