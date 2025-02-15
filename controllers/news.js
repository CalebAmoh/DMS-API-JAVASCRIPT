const helper = require("./helper"); //access helper functions
const { prisma } = require("../prismaConfig");
require("dotenv").config();
const pool = require("../mysqlconfig");
const cache = require("memory-cache");
const connection = require("../mysqlconfig");
const newsCollection = "news";
const messageCollection = "messages";

/***********************************************************************************************************
 * handles all news creation and all news related activity in the app
 * 
 * Activities in {
	* addNews() - for add news to the app,
	* updateNews() - update the news details using the news id,
	* approveNews() - to approve a news using the news id,
	* rejectedNews() - to reject any news posted in the app using the news id,
	* getNews() - get the details of a particular news,
	* deleteNews() - for deleting a single news using the id of the news
	* getGeneratedDocs() - gets all generated documents based on loggedInUser
 * }
 ***************************************************************************************************************/

//just for testing of api speed
const testSpeed = async (req, res) => {
	console.log("testing api");
	res.status(200).json({ result: "ok 1" });
	// return;
};


//handles the creation or adding of fresh news in the app1
const addNews = async (req, res) => {
	try {
		//get request data
		const {
			title,
			message,
			postedBy,
			category,
			trending,
			source,
			bannerImageUrl,
			imageContent1Url
		} = req.body;
		const views = 0;
		const approvalStatus = "Pending";
		const addedTime = Date();
		const approvedTime = "NULL";
		const approvedBy = "NULL";
		const updatedTime = "NULL";
		console.log(req.body,"my body")
		//check if variable is an array
		if (!Array.isArray(imageContent1Url)) {
			res.status(400).json({
				result: "check image content value, array expected found string"
			});
			return;
		}

		// const bannerImage = req.files["bannerImage"][0];
		// const arrayOfImages = req.files["imageContent1"] || [];
		// const imageContent2 = req.files["imageContent2"];

		//validate if user making the request is authenticated
		if (!await helper.isAuthUser(postedBy)) {
			res.status(400).json({ result: "Unauthenticated User", code: "400" });
			return;
		}

		//data to pass to null validator
		const dataEntry = [
			{ name: "title", value: title },
			{ name: "message", value: message },
			{ name: "posted by", value: postedBy },
			{ name: "category", value: category },
			{ name: "trending", value: trending },
			{ name: "bannerImage", value: bannerImageUrl },
			{ name: "source of News", value: source }
		];

		const result = helper.checkForNullOrEmpty(dataEntry);

		// console.log(bannerImage, "this is the image");return;
		//if check is successful insert into collection
		if (result.status === "success") {
			// Parallelize the file uploads
			// const [
			// 	bannerImageUrl,
			// 	imageContent1Url,
			// 	imageContent2Url
			// ] = await Promise.all([
			// 	helper.uploadFile(bannerImage, "banner"),
			// 	helper.uploadFile(imageContent1, "images"),
			// 	helper.uploadFile(imageContent2, "images")
			// 	// Add more promises for additional files if needed
			// ]);
			// console.log("the list of images", arrayOfImages);
			// const bannerImageUrl = await helper.uploadFile(bannerImage, "banner");
			// const imageContent1Url = await Promise.all(
			// 	arrayOfImages.map(async file => {
			// 		// console.log(file,"just the file")
			// 		// console.log(await helper.isVideoFile(file),"checking file extension")

			// 		if (await helper.isVideoFile(file)) {
			// 			return await helper.uploadFile(file, "videos");
			// 		} else {
			// 			return await helper.uploadFile(file, "images");
			// 		}
			// 	})
			// );

			if (trending === "true") {
				// If true, assign the boolean true to trending
				trendingValue = true;
			} else if (trending === "false") {
				// If false, assign the boolean false to trending
				trendingValue = false;
			}

			// Add news to the collection
			const news = await prisma[newsCollection].create({
				data: {
					title,
					message,
					postedBy,
					approvalStatus,
					addedTime,
					approvedBy,
					category,
					trending: trendingValue,
					views,
					bannerImageUrl,
					imageContent1Url,
					source
				}
			});

			//if the data is successful return success to the user
			if (news) {
				// Send a response
				res.status(200).json({ result: "news added", code: "200" });
			} else {
				res.status(400).json({ result: "Failed to add news", code: "400" });
			}
		} else {
			res.status(400).json({ result: result.message, code: "400" });
		}
	} catch (error) {
		console.log("fuck this ", error);
		res.status(500).json({
			result: "An error occurred, see logs for details",
			code: "500"
		});
	}
};


//update news
const updateNews = async (req, res) => {
	try {
		// Get request data
		const {
			newsId,
			title,
			message,
			category,
			trending,
			updatedBy,
			bannerImageUrl,
			imageContent1Url
		} = req.body;
		const updatedTime = new Date();
		const approvalStatus = "Pending";
		const rejectedReason = "NULL";

		//check if variable is an array
		if (!Array.isArray(imageContent1Url)) {
			res.status(400).json({
				result: "check image content value, array expected found string"
			});
			return;
		}

		// Data to pass to null validator1
		const dataEntry = [
			{ name: "newsId", value: newsId },
			{ name: "title", value: title },
			{ name: "message", value: message },
			{ name: "category", value: category },
			{ name: "trending", value: trending },
			{ name: "updatedBy", value: updatedBy },
			{ name: "bannerImage", value: bannerImageUrl }
		];

		const result = helper.checkForNullOrEmpty(dataEntry);

		// If check is successful, update the news in the collection
		if (result.status === "success") {
			// Validate if the user making the request is authenticated
			if (!await helper.isAuthUser(updatedBy)) {
				res.status(400).json({ result: "Unauthenticated User", code: "400" });
				return;
			}

			// Check if documents exist before attempting to update
			const existingNewsData = await helper.getObjectById(
				newsCollection,
				newsId
			);
			if (!existingNewsData) {
				res.status(400).json({ result: "news not found", code: "400" });
				return;
			}

			// Handle file updates (if needed)
			// const [bannerImage, imageContent1, imageContent2] = [
			// 	req.files["bannerImage"],
			// 	req.files["imageContent1"],
			// 	req.files["imageContent2"]
			// ];

			// // Delete the old banner image if a new one is provided1
			// await Promise.all([
			// 	bannerImage && existingNewsData.bannerImageUrl
			// 		? helper.deleteFile(existingNewsData.bannerImageUrl, "banner")
			// 		: Promise.resolve(),
			// 	imageContent1 && existingNewsData.imageContent1Url
			// 		? helper.deleteFile(existingNewsData.imageContent1Url, "images")
			// 		: Promise.resolve(),
			// 	imageContent2 && existingNewsData.imageContent2Url
			// 		? helper.deleteFile(existingNewsData.imageContent2Url, "images")
			// 		: Promise.resolve()
			// ]);

			//make the value a boolean
			const trendingValue = trending === "true" ? true : false;

			// Update news fields in the database
			// const updatedNews = await prisma[newsCollection].update({
			// 	where: { id: newsId },
			// 	data: {
			// 		title,
			// 		message,
			// 		category,
			// 		trending: trendingValue,
			// 		updatedBy,
			// 		approvalStatus,
			// 		rejectedReason,
			// 		bannerImageUrl: bannerImage
			// 			? await helper.uploadFile(bannerImage, "banner")
			// 			: existingNewsData.bannerImageUrl,
			// 		imageContent1Url: imageContent1
			// 			? await helper.uploadFile(imageContent1, "images")
			// 			: existingNewsData.imageContent1Url,
			// 		imageContent2Url: imageContent2
			// 			? await helper.uploadFile(imageContent2, "images")
			// 			: existingNewsData.imageContent2Url
			// 	}
			// });

			const updatedNews = await prisma[newsCollection].update({
				where: { id: newsId },
				data: {
					title,
					message,
					category,
					trending: trendingValue,
					updatedBy,
					approvalStatus,
					rejectedReason,
					bannerImageUrl,
					imageContent1Url
				}
			});

			if (updatedNews) {
				// Send the response with the updated news data
				res.status(200).json({
					result: "News updated successfully",
					code: "200",
					updatedNews: updatedNews
				});
			} else {
				res.status(400).json({ result: "Failed to update news", code: "400" });
			}
		} else {
			res.status(400).json({ result: result.message, code: "400" });
		}
	} catch (error) {
		console.log("Error:", error);
		res
			.status(500)
			.json({ result: "An error occurred, see logs for details", code: "500" });
	}
};

//delete news

//approve news
const approveNews = async (req, res) => {
	try {
		const { newsId, approvedBy } = req.body;
		const approvalStatus = "Approved";
		const approvedTime = Date();

		//pass the data into an array for validation
		const dataEntry = [
			{ name: "approved by", value: approvedBy },
			{ name: "news id", value: newsId }
		];

		//check for null or empty values from data entry
		const result = helper.checkForNullOrEmpty(dataEntry);
		console.log("check", result);

		//if check is successful update the news
		if (result.status === "success") {
			// Check if the user is already logged in or authenticated
			if (!await helper.isAuthUser(approvedBy)) {
				res.status(400).json({ result: "Unauthenticated User", code: "400" });
				return;
			}

			// Update news fields in the database1
			const existingNewsData = await helper.getObjectById(
				newsCollection,
				newsId
			);
			if (!existingNewsData) {
				res.status(400).json({ result: "news not found", code: "400" });
				return;
			}

			if (existingNewsData.approvalStatus === "Approved") {
				res.status(200).json({
					result: "News has already been approved, you cannot approve",
					code: "200"
				});
				return;
			}

			if (existingNewsData.approvalStatus === "Rejected") {
				res.status(200).json({
					result:
						"News has already been rejected, you cannot approve until the neccessary changes has taken place",
					code: "200"
				});
				return;
			}

			// Update news fields in the database
			const updatedNews = await prisma[newsCollection].update({
				where: { id: newsId },
				data: {
					approvalStatus,
					approvedBy
				}
			});

			if (updatedNews) {
				// Send the response with the updated news data
				console.log("updated news data", updatedNews.title);
				res.status(200).json({ result: "News is approved", code: "200" });
			} else {
				res.status(400).json({ result: "Failed to approve", code: "400" });
			}
		} else {
			res.status(400).json({ result: result.message, code: "400" });
		}
	} catch (error) {
		console.log("this is the fucking reason", error);
		res.status(500).json({
			result: "An error occurred, see logs for details",
			code: "500"
		});
	}
};

//reject news
const rejectedNews = async (req, res) => {
	try {
		const { newsId, rejectedBy, rejectedReason } = req.body;
		const approvalStatus = "Rejected";
		const rejectedTime = Date();

		// Check if the user is authenticated
		if (!await helper.isAuthUser(rejectedBy)) {
			res.status(400).json({ result: "Unauthenticated User", code: "400" });
			return;
		}

		// Validate data
		const dataEntry = [
			{ name: "rejected by", value: rejectedBy },
			{ name: "news id", value: newsId },
			{ name: "rejected reason", value: rejectedReason }
		];
		const result = helper.checkForNullOrEmpty(dataEntry);

		if (result.status !== "success") {
			res.status(400).json({ result: result.message, code: "400" });
			return;
		}

		// Check if the news exists and is not already approved
		const existingNewsData = await helper.getObjectById(newsCollection, newsId);
		if (!existingNewsData) {
			res.status(400).json({ result: "news not found", code: "400" });
			return;
		}

		if (existingNewsData.approvalStatus === "Approved") {
			res.status(200).json({
				result: "News has already been approved, you cannot reject",
				code: "200"
			});
			return;
		}

		console.log(
			"what is the, approval status",
			existingNewsData.approvalStatus
		);
		if (existingNewsData.approvalStatus === "Rejected") {
			res.status(200).json({
				result: "News has already been rejected, you cannot reject again",
				code: "200"
			});
			return;
		}

		// Combine updates into a single call
		// Update news fields in the database
		console.log("rejected by", rejectedBy);
		const updatedNews = await prisma[newsCollection].update({
			where: { id: newsId },
			data: {
				approvalStatus,
				rejectedBy,
				rejectedReason
			}
		});

		if (updatedNews) {
			res.status(200).json({
				result: "News is rejected",
				code: "200"
			});
		} else {
			res.status(200).json({
				result: "Failed to reject news",
				code: "200"
			});
		}
	} catch (error) {
		console.error(error);
		res.status(500).json({
			result: "An error occurred, see logs for details",
			code: "500"
		});
	}
};


//get a single news
const getNews = async (req, res) => {
	try {
		//get data from request
		const nId = req.params.newsId;
		
		//check to see if the id is strictly an integer
		const newsId = /^\d+$/.test(req.params.newsId)
			? parseInt(req.params.newsId)
			: NaN;

		//structure the data for validation
		dataEntry = [{ name: "news id", value: newsId }];

		//check for null or empty values from data entry
		const result = helper.checkForNullOrEmpty(dataEntry);


		//if the news id is strictly a number then go ahead and fetch data from mews ai data source
		//else fetch gna external source
		if (isNaN(newsId)) {
			if (result.status !== "success") {
				res.status(400).json({ result: result.message, code: "400" });
				return;
			}

			// Check if the news exists
			const existingNewsData = await helper.getObjectById(newsCollection, nId);
			if (!existingNewsData) {
				res.status(400).json({ result: "news not found", code: "400" });
				return;
			}

			console.log(existingNewsData);
			//return news details
			res.status(200).json({
				result: "News details",
				newsDetails: existingNewsData,
				code: "200"
			});
		} else {
			// Check if the data is already in the cache
			const cacheExternalNews = cache.get("cacheExternalNews");
			if (cacheExternalNews) {
				//loop through array to find the object with the particular id that
				//was passed
				for (const element of cacheExternalNews) {
					if (element.id == newsId) {
						console.log("here we go", element);
						res.status(200).json({
							result: "News details",
							newsDetails: element,
							code: "200"
						});
						return;
					}
				}
				
			} else {
				res.status(400).json({
					result: "News details",
					newsDetails: "news not found",
					code: "400"
				});
				return;
			}
		}
	} catch (error) {
		console.error("fuck this shit never want to come here", error);
		res.status(500).json({
			result: "An error occurred, see logs for details",
			code: "500"
		});
	}
};


const deleteNews = async (req, res) => {
	try {
		//get the id of the news
		const { id } = req.body;

		//pass the data into an array for validation
		const dataEntry = [{ name: "news id", value: id }];

		//check for null or empty values from data entry
		const result = helper.checkForNullOrEmpty(dataEntry);

		// Check if documents exist before attempting to update
		const existingNewsData = await helper.getObjectById(
			newsCollection,
			id
		);
		if (!existingNewsData) {
			res.status(400).json({ result: "news not found", code: "400" });
			return;
		}

		//if check is unsuccessful return results
		if (result.status !== "success") {
			res.status(400).json({ result: result.message, code: "400" });
			return;
		}

		//if the check is successful go ahead and delete the news
		const deleteNews = await prisma[newsCollection].delete({
			where: {
				id: id
			}
		});

		//if success
		if (deleteNews) {
			res.status(200).json({ result: "News is deleted", code: "200" });
		} else {
			res.status(400).json({ result: "Failed to delete news", code: "400" });
		}
	} catch (error) {
		console.log("Error:", error);
		res.status(500).json({
			result: "An error occurred, see logs for details",
			code: "500"
		});
	}
};


const getGeneratedDocs = async (req, res) => {
	try {
	  const query = `SELECT  request_documents.*, doctype_details.description AS doctype_name
						FROM request_documents
	JOIN code_creation_details AS doctype_details
		ON request_documents.doctype_id = doctype_details.id
		AND doctype_details.code_id = 2
	WHERE 
		request_documents.posted_by = 1;`;
  
	  // Get a connection from the pool
	  pool.getConnection((err, connection) => {
		if (err) {
		  console.error("Error getting connection from pool: ", err);
		  res.status(500).json({ error: "Database connection failed." });
		  return;
		}
  
  
		// Execute the query
		connection.query(query, (err, results) => {
		  if (err) {
			console.error("Error executing query: ", err);
			res.status(500).json({ error: "Query execution failed." });
		  } else {
			// console.log("Query successful: ", results);
			res.status(200).json({
			  documents: results,
			  code: "200",
			});
		  }
  
		  // Release the connection back to the pool
		  connection.release();
		});
	  });
	} catch (error) {
	  console.error("Unexpected error: ", error);
	  res.status(500).json({ error: "An unexpected error occurred." });
	}
};

module.exports = {
	addNews,
	updateNews,
	approveNews,
	rejectedNews,
	getNews,
	testSpeed,
	deleteNews,
	getGeneratedDocs
	// other controller functions if any
};
