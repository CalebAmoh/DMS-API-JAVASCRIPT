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
 * getAdminDashboardValues() - Retrieves all dashboard related data,
 * }
 ***************************************************************************************************************/

const getAdminDashboardValues = async (req, res) => {
	try {

		const {userId,role} = req.params;

		let numOfGeneratedDocsResult
		let numOfApprovedDocsResult
		let numOfUnApprovedDocsResult 
		let numOfRejectedDocsResult
		let recentDocsResult
		if(role === "admin"){
			//get the count of generated documents
			const numOfGeneratedDocsQuery = `select count(*) as generateddocs from request_documents`
			numOfGeneratedDocsResult = await helper.selectRecordsWithQuery(numOfGeneratedDocsQuery);

			//get the count of approved documents
			const numOfApprovedDocsQuery = `select count(*) as approveddocs from request_documents where status=?`
			numOfApprovedDocsResult = await helper.selectRecordsWithQuery(numOfApprovedDocsQuery,['APPROVED']);
			
			
			//get the count of unapproved documents
			const numOfUnApprovedDocsQuery = `select count(*) as unapproveddocs from request_documents where status!=?`
			numOfUnApprovedDocsResult = await helper.selectRecordsWithQuery(numOfUnApprovedDocsQuery,['APPROVED']);
			
			//get the count of unapproved documents
			const numOfRejectedDocsQuery = `select count(*) as rejecteddocs from request_documents where status=?`
			numOfRejectedDocsResult = await helper.selectRecordsWithQuery(numOfRejectedDocsQuery,['REJECTED']);

			//select the most recent documents 
			const recentDocsQuery = `SELECT  request_documents.*, doctype_details.description AS doctype_name FROM request_documents JOIN code_creation_details AS doctype_details ON request_documents.doctype_id = doctype_details.id AND doctype_details.code_id = 2 ORDER BY request_documents.id DESC LIMIT 4;`
			recentDocsResult = await helper.selectRecordsWithQuery(recentDocsQuery)
		}else{
			//get the count of generated documents
			const numOfGeneratedDocsQuery = `select count(*) as generateddocs from request_documents where posted_by = ?`
			numOfGeneratedDocsResult = await helper.selectRecordsWithQuery(numOfGeneratedDocsQuery,[userId]);

			//get the count of approved documents
			const numOfApprovedDocsQuery = `select count(*) as approveddocs from request_documents where status=? and posted_by =?`
			numOfApprovedDocsResult = await helper.selectRecordsWithQuery(numOfApprovedDocsQuery,['APPROVED',userId]);
			
			
			//get the count of unapproved documents
			const numOfUnApprovedDocsQuery = `select count(*) as unapproveddocs from request_documents where (status=? or status=?) and posted_by = ?`
			numOfUnApprovedDocsResult = await helper.selectRecordsWithQuery(numOfUnApprovedDocsQuery,['PENDING','DRAFT',userId]);
			
			//get the count of unapproved documents
			const numOfRejectedDocsQuery = `select count(*) as rejecteddocs from request_documents where status=? and posted_by = ?`
			numOfRejectedDocsResult = await helper.selectRecordsWithQuery(numOfRejectedDocsQuery,['REJECTED',userId]);

			const recentDocsQuery = `SELECT  request_documents.*, doctype_details.description AS doctype_name FROM request_documents JOIN code_creation_details AS doctype_details ON request_documents.doctype_id = doctype_details.id AND doctype_details.code_id = 2 WHERE request_documents.posted_by = ? ORDER BY request_documents.id DESC LIMIT 4;`
			recentDocsResult = await helper.selectRecordsWithQuery(recentDocsQuery,[userId])
		}

		res.status(200).json({result:[numOfRejectedDocsResult.data,numOfUnApprovedDocsResult.data,numOfApprovedDocsResult.data,numOfGeneratedDocsResult.data,recentDocsResult.data],status:"200"})
	} catch (error) {
		res.status(400).json({result:"Failed to retrieve data",status:"400"})
	}
};

module.exports = {
	getAdminDashboardValues
};
