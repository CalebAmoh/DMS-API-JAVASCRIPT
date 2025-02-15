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
 * Checks if a value exists in a specific column of a MySQL table
 * @param {string} tableName - Name of the table to check
 * @param {string} columnName - Name of the column to check for uniqueness
 * @param {any} value - Value to check if it exists
 * @returns {Promise<Object>} Object containing status and message
 */
const checkUniqueColumn = async (tableName, columnName, value) => {
	try {
		// Query to check if value exists in the specified column
		const query = `SELECT COUNT(*) as count FROM ${tableName} WHERE ${columnName} = ?`;

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

				connection.query(query, [value], (err, results) => {
					connection.release();

					if (err) {
						console.error("Error executing query:", err);
						reject({
							status: "error", 
							message: "Failed to check unique value"
						});
						return;
					}

					// If count is 0, value is unique
					if (results[0].count === 0) {
						resolve({
							status: "success",
							message: "Value is unique"
						});
					} else {
						resolve({
							status: "error",
							message: `Value already exists in ${columnName}`
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

//check for the availability of a collection
const isCollectionEmpty = async collectionName => {
	const collectionRef = db.collection(collectionName);
	const collectionSnapshot = await collectionRef.get();

	if (collectionSnapshot.empty) {
		// The collection does not exist
		return true;
	} else {
		return false;
	}
};

//this helper function helps with the upload of multiple files at a go
async function uploadFile(fileArray, destinationFolder) {
	try {
		// console.log("inside the helper",fileArray);
		// if (!fileArray || !fileArray.length) {
		// 	throw new Error("No files provided");
		// }

		const fileBuffer = fileArray.buffer;
		const fileName = `${uuidv4()}.png`;
		const fileDestination = `${destinationFolder}/${fileName}`;
		const fileStream = bucket.file(fileDestination).createWriteStream();

		fileStream.end(fileBuffer);

		await new Promise((resolve, reject) => {
			fileStream.on("finish", resolve);
			fileStream.on("error", reject);
		});

		const [fileUrl] = await bucket
			.file(fileDestination)
			.getSignedUrl({ action: "read", expires: "01-01-2033" });

		return fileUrl;
	} catch (error) {
		console.error("Error uploading file:", error);
		throw error;
	}
}

// Update the deleteFile function to accept the bucket name and fileUrl as a parameter
async function deleteFile(fileUrl, destinationFolder) {
	try {
		const fileName = fileUrl.split("/").pop().split("?")[0]; // Extracting the file name from the URL

		if (fileName != "NULL") {
			const fileDestination = `${destinationFolder}/${fileName}`; // Exclude query parameters

			await bucket.file(fileDestination).delete();
		}
	} catch (error) {
		console.error(`Error deleting file: ${fileUrl}`, error);
		throw error;
	}
}

//checks if an object is in a collection using the id
async function getObjectById(collectionName, id) {
	try {
		// Check if id is a valid hexadecimal string with exactly 12 bytes
		if (!/^[0-9a-fA-F]{24}$/.test(id)) {
			return null;
		}

		const where = {};

		// Conditionally add fields to the where object
		if (
			collectionName === usersCollection ||
			collectionName === newsCollection ||
			collectionName === messageCollection
		) {
			where.id = id;
		} else if (
			collectionName !== usersCollection &&
			collectionName !== newsCollection
		) {
			console.log("second");
			where.userId = id;
		}

		const objectQuery = await prisma[collectionName].findFirst({
			where: where
		});

		return objectQuery;
	} catch (error) {
		console.error(`Error querying ${collectionName}:`, error);
		throw new Error(`Error querying ${collectionName}`);
	}
}

//checks if an object is in a collection using any attirbute
/**
 * 
 * @param {name of the collection to check} collectionName 
 * @param {the name of the attribute that checks will be done with} attribute 
 * @param {the value to be checked for} attributeVal 
 * @returns true if data is found or false if no data found
 */
async function getObjectByAttribute(collectionName, attributeVal) {
	try {
		

		const objectQuery = await prisma[collectionName].findFirst({
			where: {
				type: attributeVal
			}
		});
		if (objectQuery) {
			return true;
		} else {
			return false;
		}
	} catch (error) {
		console.error(`Error querying ${collectionName}:`, error);
		throw new Error(`Error querying ${collectionName}`);
	}
}

async function isVideoFile(file) {
	// Get the file extension
	// Extract the file extension
	const fileExtension = path.extname(file.originalname).toLowerCase();

	// List of common video file extensions
	const videoExtensions = [
		".mp4",
		".mkv",
		".avi",
		".mov",
		".wmv",
		".flv",
		".webm"
	];

	// Check if the file extension is in the list of video extensions
	return videoExtensions.includes(fileExtension);
}

// async function listFiles(folderName) {
// 	const [files] = await bucket.getFiles({ prefix: folderName + "/" });
// 	console.log("Files in folder:", files.map(file => file.name));
// }

/**
 * 
 * @param {handles the source of the data retriving} url 
 * @param {handles the type of request, it be an api or normal database request} type 
 * @param {handles keyword for news search} keyword 
 */
async function fetchData(url, type, keyword, database) {
	try {
		//do this if the external api is to be called
		if (type == "api") {
			let data = JSON.stringify({
				per_page: 5,
				search: keyword
				// orderby: "date"
			});

			let config = {
				method: "get",
				maxBodyLength: Infinity,
				url: url,
				headers: { "Content-Type": "application/json" },
				data: data
			};

			// Returning the axios request directly
			return axios.request(config).then(response => {
				// console.log(response.data);
				return response.data;
			});
		}

		//do this if the news data is to be retrieved
		if (type == "news") {
			// Connect to MongoDB
			const uri1 =
				"mongodb+srv://henryamoh30:ARD0CRPLi0mpGVw4@cluster0.lvcbpoh.mongodb.net/mews?retryWrites=true&w=majority";
			const client1 = new MongoClient(uri1);
			const database1 = client1.db("mews");
			const collection = database1.collection(newsCollection);
			const cursor = await collection.aggregate(url);
			const relatedNews = await cursor.toArray();

			// Close MongoDB connection
			await client1.close();
			return relatedNews;
		}

		//if the type is the trending news do this
		if (type == "trending") {
			// Retrieve all trending news from the database
			const trendingNews = await prisma[newsCollection].findMany({
				where: {
					trending: true,
					approvalStatus: "Approved"
				}
			});

			// Extract only the desired properties from each news item
			const simplifiedTrendingNews = trendingNews.map(newsItem => ({
				id: newsItem.id,
				title: newsItem.title,
				views: newsItem.views,
				bannerImageUrl: newsItem.bannerImageUrl
				// Add other properties you want to include
			}));

			return simplifiedTrendingNews;
		}
	} catch (error) {
		throw new Error(`Error fetching data from ${url}: ${error.message}`);
	}
}

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

module.exports = {
	checkForNullOrEmpty,
	checkUniqueColumn,
	isAuthUser,
	isCollectionEmpty,
	uploadFile,
	deleteFile,
	getObjectById,
	isVideoFile,
	fetchData,
	getObjectByAttribute,
	dynamicInsert
	// other controller functions if any
};
