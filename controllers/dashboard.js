const MongoClient = require("mongodb").MongoClient;
const helper = require("./helper"); //access helper functions
const { prisma } = require("../prismaConfig");
require("dotenv").config();
const axios = require("axios");
const cache = require("memory-cache");
const newsCollection = "news";

/***********************************************************************************************************
 * handles all stats 
 * 
 * Activities in {
	* getDataCounts() - for add news to the admin dashboard,
 * }
 ***************************************************************************************************************/

const getDashboardValues = async (res, req) => {
	const countAllNews = await prisma[newsCollection].aggregate({
		_count: {
			trending: true
		}
	});
	const newsCount = await prisma[newsCollection].count();

	console.log(countAllNews._count.trending);
	console.log(newsCount);

	// res.status(200).json({
	// 	result: "results",
	// 	code: "500"
	// });
};

module.exports = {
	getDashboardValues
};
