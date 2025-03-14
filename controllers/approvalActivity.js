const helper = require("./helper"); //access helper functions
require("dotenv").config();
const axios = require('axios');
const pool = require("../mysqlconfig");
const approvalActivityCollection = "approval_activities";
const documentCollection = "request_documents";

/***********************************************************************************************************
 * handles all approver setups and all related activity in the app
 * 
 * Activities in {
	* getSubmittedDocs() - get all documents that are submitted for approval,
	* getApproverUsers() - get all the users who are approvers,
 * }
 ***************************************************************************************************************/

// At the top of the file, add these constants
const STATUS = {
	SUBMITTED: 'submitted',
	PENDING: 'PENDING',
	APPROVED: 'APPROVED',
  DRAFT: 'DRAFT'
};

const ERROR_MESSAGES = {
	DB_CONNECTION: "Database connection failed",
	QUERY_FAILED: "Query execution failed",
	MISSING_PARAMS: "Missing required parameters",
	DOC_NOT_FOUND: "Document not found"
};

//just for testing of api speed
const testSpeed = async (req, res) => {
	console.log("testing api");
	res.status(200).json({ result: "ok 1" });
	// return;
};

//returns all submitted docs
const getSubmittedDocs = async (req, res) => {
	try {
        const query = `SELECT  request_documents.*, doctype_details.description AS doctype_name
                          FROM request_documents
      JOIN code_creation_details AS doctype_details
          ON request_documents.doctype_id = doctype_details.id
          AND doctype_details.code_id = 1
      WHERE 
          request_documents.posted_by = 3
          AND request_documents.status IN ('submitted');`;
    
        // Get a connection from the pool
        pool.getConnection((err, connection) => {
          if (err) {
            console.error("Error getting connection from pool: ", err);
            res.status(500).json({ message: "Database connection failed." });
            return;
          }
    
    
          // Execute the query
          connection.query(query, (err, results) => {
            if (err) {
              console.error("Error executing query: ", err);
              res.status(500).json({ message: "Query execution failed." });
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
        console.error("Unexpected message: ", error);
        res.status(500).json({ message: "An unexpected error occurred." });
    }
};


/**
 * Returns all pending documents
 * @param {Object} req - Request object userId
 * @param {Object} res - Response object
 * @returns {Object} JSON response with pending docs
 */
const getPendingDocs = async (req, res) => {
	try {
		const {userId} = req.body;
		const status_approved = STATUS.APPROVED;
		const status_draft = STATUS.DRAFT;

    console.log("checking user id", userId);
		
    // const query = `
    //   SELECT DISTINCT rd.*, doctype_details.description AS doctype_name
    //   FROM request_documents rd
    //   JOIN code_creation_details AS doctype_details
    //     ON rd.doctype_id = doctype_details.id
    //     AND doctype_details.code_id = 2
    //   INNER JOIN doc_approvers da 
    //     ON da.doctype_id = rd.doctype_id
    //     AND rd.approval_stage = da.approval_stage
    //   WHERE 
    //     da.approver_id = ${userId}
    //     AND (rd.status != '${status_approved}' AND rd.status != '${status_draft}')
    //     AND NOT EXISTS (
    //       SELECT 1 
    //       FROM approval_activities aa 
    //       WHERE aa.doc_id = rd.id 
    //       AND aa.approved_by = ${userId}
    //       AND rd.approval_stage = (
    //         SELECT approval_stage 
    //         FROM request_documents 
    //         WHERE id = rd.id
    //       )
    //     )
    //     AND (
    //       /* Show if user is mandatory approver regardless of is_required_approvers_left */
    //       da.is_mandatory = 1
    //       OR 
    //       /* Show if user is non-mandatory approver AND required approvers are not left */
    //       (da.is_mandatory = 0 AND rd.is_required_approvers_left = 0)
    //     )`;

    // AND aa.id IS NULL;
    // Get a connection from the pool
    
    const query = `

      SELECT DISTINCT rd.*, doctype_details.description AS doctype_name

      FROM request_documents rd

      JOIN code_creation_details AS doctype_details

        ON rd.doctype_id = doctype_details.id

        AND doctype_details.code_id = 2

      INNER JOIN doc_approvers da 

        ON da.doctype_id = rd.doctype_id

        AND da.approval_stage = rd.approval_stage

      WHERE 

        da.approver_id = ${userId}

        AND rd.status != '${status_approved}' 

        AND rd.status != '${status_draft}'

        AND NOT EXISTS (

          SELECT 1 

          FROM approval_activities aa 

          WHERE aa.doc_id = rd.id 

          AND aa.approved_by = ${userId}

          AND aa.approval_stage = rd.approval_stage

        )

        AND (

          /* Show if user is mandatory approver regardless of is_required_approvers_left */

          da.is_mandatory = 1

          OR 

          /* Show if user is non-mandatory approver AND required approvers are not left */

          (da.is_mandatory = 0 AND rd.is_required_approvers_left = 0)

        )`;

    
    pool.getConnection((err, connection) => {
      if (err) {
        console.error("Error getting connection from pool: ", err);
        res.status(500).json({ message: "Database connection failed." });
        return;
      }


      // Execute the query
      connection.query(query, (err, results) => {
        if (err) {
          console.error("Error executing query: ", err);
          res.status(500).json({ message: "Query execution failed." });
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
		console.error("Error in getPendingDocs:", error);  // Improved error message
		res.status(500).json({
			message: "An unexpected error occurred",
			code: "500"
		});
	}
};

/**
 * Approves a document based on its ID and updates approval status
 * @param {Object} req - Request object containing docId, userId,recommended_amount and remarks
 * @param {Object} res - Response object
 * @returns {Object} JSON response with approval status
 */
const approveDoc = async (req, res) => {
  try {
        const { docId, userId, recommended_amount, remarks,db_account,cr_account,trans_type } = req.body.data;
        
        // Validate required parameters
        if (!docId || !userId) {
          return res.status(400).json({
            message: "Missing required parameters",
            code: "400"
          });
        }

        // First query to get current document status and approval stage
        const getDocQuery = `SELECT rd.current_approvers,rd.doctype_id,rd.status, rd.approval_stage,count(a.doctype_id) max_approval_level FROM request_documents rd join doc_approval_setups a ON a.doctype_id = rd.doctype_id WHERE rd.id = ?`;
        const docResults = await helper.selectRecordsWithQuery(getDocQuery, [docId]);
        
        const document = docResults.data[0];
        let approvalStage = parseInt(document.approval_stage);
        let current_approvals = document.current_approvers === null ? 0 : parseInt(document.current_approvers);
        let doctype_id = document.doctype_id;
        let max_approval_level = document.max_approval_level;
        
        //get the number of approvers of that level
        const getCurrentLevelApproversCount = `SELECT (SELECT COUNT(*) FROM doc_approvers WHERE doctype_id = ? AND approval_stage = ?) as all_approvers`;
        const all_approvers = await helper.selectRecordsWithQuery(getCurrentLevelApproversCount,[doctype_id,approvalStage])
        
        let countAllApprovers = parseInt(all_approvers.data[0].all_approvers);

        //get the number of people who are required to approve the document
        const getCurrentLevelRequiredApproversCount = `SELECT (SELECT COUNT(*) FROM doc_approvers WHERE doctype_id = ? AND approval_stage = ? AND is_mandatory = ?) as required_approvers`;
        const required_approvers_results = await helper.selectRecordsWithQuery(getCurrentLevelRequiredApproversCount,[doctype_id,approvalStage,1])

        let countRequiredApprovers = parseInt(required_approvers_results.data[0].required_approvers);

        //get the number of people who have approved the document on the current level
        const getCurrentLevelApprovedApproversCount = `SELECT (SELECT current_approvers from request_documents where id = ?) as approved_approvers`;
        const approved_approvers = await helper.selectRecordsWithQuery(getCurrentLevelApprovedApproversCount,[docId])

        let countApprovedApprovers = parseInt(approved_approvers.data[0].approved_approvers===null ? 0 : approved_approvers.data[0].approved_approvers);

        //get quorum for the document's current approval level
        const getQuorum = `SELECT (SELECT quorum FROM doc_approval_setups WHERE doctype_id = ? AND approval_stage = ?) as quorum`;
        const quorum_results = await helper.selectRecordsWithQuery(getQuorum,[doctype_id,approvalStage])

        let quorum = parseInt(quorum_results.data[0].quorum);

        //get the approvers who are not required to approve that have approved the document
        const getApproversWhoHaveApproved = `SELECT (SELECT COUNT(*) FROM approval_activities WHERE doc_id = ?  AND approved_by IN (SELECT approver_id FROM doc_approvers WHERE doctype_id = ? AND approval_stage = ? AND is_mandatory = ?)) as non_required_approvers_approved`;
        const non_required_approvers_approved_results = await helper.selectRecordsWithQuery(getApproversWhoHaveApproved,[docId,doctype_id,approvalStage,0])

        let countNonRequiredApproversApproved = parseInt(non_required_approvers_approved_results.data[0].non_required_approvers_approved);

        //check if the imcoming user is required to approve the document
        const isApproverRequiredQuery = `select count(*) as is_approver_required from doc_approvers where doctype_id = ? and approval_stage = ? and approver_id = ? and is_mandatory = ?`;
        const isApproverRequired_results = await helper.selectRecordsWithQuery(isApproverRequiredQuery,[doctype_id,approvalStage,userId,1])

        let isApproverRequired = parseInt(isApproverRequired_results.data[0].is_approver_required);


        //if user is required to approve the document check if the user will complete the required approvers
        let isRequiredApproversLeft = 0;
        let countNonRequiredApprovers = quorum - countRequiredApprovers; // the number of approvers who are required to approve
        if(isApproverRequired !== 1){
          const willCompleteNonRequiredApprovers = (countNonRequiredApproversApproved + 1) >= countNonRequiredApprovers;
          isRequiredApproversLeft = willCompleteNonRequiredApprovers ? 1 : 0;
        }else{
          const willCompleteRequiredApprovers = (countApprovedApprovers + 1) >= countRequiredApprovers;
          if(willCompleteRequiredApprovers){
            isRequiredApproversLeft = 0;
          }
        }

        //increment the approval stage if the required number of approvers have approved the document
        console.log("countApprovedApprovers",countApprovedApprovers+1);
        const willCompleteStage = (countApprovedApprovers + 1) >= quorum;
        console.log("willCompleteStage",willCompleteStage);
        const newApprovalStage = willCompleteStage ? approvalStage + 1 : approvalStage; //if the stage is complete, increment the stage
        const current_approvers = willCompleteStage ? 0 : current_approvals+1; //if the stage is complete, reset the current approvers to 0
        isRequiredApproversLeft = willCompleteStage ? 0 : isRequiredApproversLeft; //if the stage is complete, reset the isRequiredApproversLeft to 0
        const isFullyApproved = newApprovalStage > document.max_approval_level;
        const newStatus = isFullyApproved ? 'APPROVED' : 'PENDING';

        // Add this query before calculating willCompleteStage
        const getMandatoryApproversCount = `SELECT COUNT(*) as mandatory_count FROM doc_approvers WHERE doctype_id = ? AND approval_stage = ? AND is_mandatory = 1`;
        const mandatoryResults = await helper.selectRecordsWithQuery(getMandatoryApproversCount,[doctype_id,newApprovalStage])

        const mandatoryCount = mandatoryResults.data[0].mandatory_count;

        // get is isRequiredApproversLeft
        isRequiredApproversLeft = willCompleteStage ? (mandatoryCount >= quorum ? 1 : 0) : isRequiredApproversLeft;

        
        if(!isFullyApproved){
          // Modified approval query to include approval_stage
          // const approvalQuery = `INSERT INTO approval_activities (doc_id, approved_by, comment, approval_stage) VALUES (?, ?, ?, ?)`;
          const approvalActivityData = {doc_id: docId, approved_by: userId, comment: remarks, approval_stage: approvalStage};
          const approvalResult = await helper.dynamicInsert(approvalActivityCollection, approvalActivityData);

          if(approvalResult.status === "success"){
            //update the documents details
            // const updateDocQuery = `UPDATE request_documents SET status = ?, approval_stage = ?, current_approvers = ?, is_required_approvers_left = ? WHERE id = ?`;
            const documentData = {status: newStatus, approval_stage: newApprovalStage, current_approvers: current_approvers, is_required_approvers_left: isRequiredApproversLeft};
            const updateDocResult = await helper.dynamicUpdateWithId(documentCollection,documentData,docId);
          }
        }

        //check if the document is fully approved
        if(isFullyApproved){
              
              if(db_account){
               
                //for generating document reference
                const generateDocRef = () => {
                  const randomStr = Math.random().toString(36).substring(2, 15);
                  const timestamp = Date.now();
                  return randomStr.substr(0, 2) + timestamp;
                };

                const generateTransRef = () => {

                  // Similar to PHP's rand(), generates random integer between min and max
                  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
                  const randomStr = Math.random().toString(36).substring(2, 8); //get random string 
                  const timestamp = Date.now();
                  const randomNum = rand(10, 99); // Add random 4-digit number
                  return randomStr.substr(0, 2) + timestamp + randomNum;

                };

                const ref_no = generateDocRef(); //reference for document
                const trans_ref = generateTransRef(); //reference for transaction
                const currency = "SLE";
                console.log("this is the trans ref", trans_ref)
                const data = JSON.stringify({
                  "approvedBy": userId,
                  "channelCode": "HRP",
                  "transType": "SAL",
                  "debitAccounts": [{
                    "debitAmount": recommended_amount,
                    "debitAccount": db_account,
                    "debitCurrency": currency,
                    "debitNarration": "Debit for "+trans_type,
                    "debitProdRef": "NS_"+trans_ref,
                    "debitBranch":"000"
                  }],
                  "creditAccounts": [{
                    "creditAmount": recommended_amount,
                    "creditAccount": cr_account,
                    "creditCurrency": currency,
                    "creditNarration": "Credit for "+trans_type,
                    "creditProdRef": "BS_"+trans_ref,
                    "creditBranch": "000"
                  }],
                  "referenceNo": ref_no,
                  "postedBy": userId
                })


                let config = {
                  method: 'put',
                  maxBodyLength: Infinity,
                  url: 'http://10.203.14.16:8384/core/api/v1.0/account/performBulkPayment',
                  headers: { 
                    'x-api-key': '20171411891', 
                    'x-api-secret': '141116517P', 
                    'Content-Type': 'application/json', 
                    'X-FORWARDED-FOR': '172.16.10.1', 
                    'Authorization': 'rererer'
                  },
                  timeout: 30000, // 30 seconds timeout
                  data : data
                };

                axios.request(config)
                .then(async(response) => {
                  if(response.data.responseCode === "000"){
                    
                    // Modified approval query to include approval_stage
                    // const approvalQuery = `INSERT INTO approval_activities (doc_id, approved_by, comment, approval_stage) VALUES (?, ?, ?, ?)`;
                    const approvalActivityData = {doc_id: docId, approved_by: userId, comment: remarks, approval_stage: approvalStage};
                    const approvalResult = await helper.dynamicInsert(approvalActivityCollection, approvalActivityData);

                    if(approvalResult.status === "success"){
                      //update the documents details
                      // const updateDocQuery = `UPDATE request_documents SET status = ?, approval_stage = ?, current_approvers = ?, is_required_approvers_left = ? WHERE id = ?`;
                      const documentData = {status: newStatus, approval_stage: newApprovalStage, current_approvers: current_approvers, is_required_approvers_left: isRequiredApproversLeft,batch_no:ref_no,is_transaction_failed: false,};
                      const updateDocResult = await helper.dynamicUpdateWithId(documentCollection,documentData,docId);
                      updateDocResult.status === "success" ? res.status(200).json({message:"Document approved successfully",code:"200"}) : res.status(400).json({message:"Failed to update document status, after successful transaction",code:"400"})
                    }
                  } else {
                    const documentData = {
                      status: newStatus, 
                      approval_stage: newApprovalStage, 
                      current_approvers: current_approvers, 
                      is_required_approvers_left: isRequiredApproversLeft,
                      is_transaction_failed: true
                    };
                    const updateResult = await helper.dynamicUpdateWithId(documentCollection, documentData, docId);
                    res.status(400).json({message:"Transaction failed, please try again",code:"200"})
                  }
                })
                .catch((error) => {
                  console.error("Transaction error:", error.code === 'ECONNABORTED' ? 'Request timeout' : error.message);
                  // connection.release();
                  res.status(500).json({
                    message: error.code === 'ECONNABORTED' ? 
                      "Transaction timed out after 30 seconds, try again or contact adminstrator" : 
                      "Transaction processing failed, try again or contact adminstrator",
                    code: "500"
                  });
                });

              }else{
                // Modified approval query to include approval_stage
                // const approvalQuery = `INSERT INTO approval_activities (doc_id, approved_by, comment, approval_stage) VALUES (?, ?, ?, ?)`;
                const approvalActivityData = {doc_id: docId, approved_by: userId, comment: remarks, approval_stage: approvalStage};
                const approvalResult = await helper.dynamicInsert(approvalActivityCollection, approvalActivityData);

                if(approvalResult.status === "success"){
                  //update the documents details
                  // const updateDocQuery = `UPDATE request_documents SET status = ?, approval_stage = ?, current_approvers = ?, is_required_approvers_left = ? WHERE id = ?`;
                  const documentData = {status: newStatus, approval_stage: newApprovalStage, current_approvers: current_approvers, is_required_approvers_left: isRequiredApproversLeft};
                  const updateDocResult = await helper.dynamicUpdateWithId(documentCollection,documentData,docId);
                  updateDocResult.status === "success" ? res.status(200).json({message:"Document approved successfully",code:"200"}): res.status(400).json({message:"Failed to update document status",code:"400"})
                }
              }
            
        }
    
  }catch (error) {
    console.error("Unexpected error in approveDoc:", error);
    res.status(500).json({
      message: "An unexpected error occurred",
      code: "500"
    });
  }
}

/**
 * Rejects a document based on its ID and updates approval status
 * @param {Object} req - Request object containing docId, userId and remarks
 * @param {Object} res - Response object
 * @returns {Object} JSON response with rejection status
 */
const rejectDoc = async (req, res) => {
  try {
    const { docId, userId, remarks } = req.body.data;
    // Validate required parameters
    if (!docId || !userId) {
      return res.status(400).json({
        message: "Missing required parameters",
        code: "400"
      });
    }

    // First query to get current document status and approval stage
    const getDocQuery = `
      SELECT rd.*, rd.approval_stage 
      FROM request_documents rd 
      WHERE rd.id = ?`;

    pool.getConnection((err, connection) => {
      if (err) {
        console.error("Error getting connection from pool:", err);
        return res.status(500).json({ 
          message: "Database connection failed",
          code: "500"
        });
      }

      connection.query(getDocQuery, [docId], (err, docResults) => {
        if (err) {
          connection.release();
          console.error("Error fetching document:", err);
          return res.status(500).json({ 
            message: "Failed to fetch document details",
            code: "500"
          });
        }

        if (!docResults.length) {
          connection.release();
          return res.status(404).json({ 
            message: "Document not found",
            code: "404"
          });
        }

        const currentApprovalStage = docResults[0].approval_stage;

        // Insert rejection record with current approval stage
        const approvalQuery = `
          INSERT INTO approval_activities 
          (doc_id, approved_by, comment, approval_stage) 
          VALUES (?, ?, ?, ?)`;

        connection.query(approvalQuery, [docId, userId, remarks, currentApprovalStage], (err, approvalResult) => {
          if (err) {
            connection.release();
            console.error("Error recording rejection:", err);
            return res.status(500).json({ 
              message: "Failed to record rejection",
              code: "500"
            });
          }

          // Update document status and reset approvers
          const updateDocQuery = `
            UPDATE request_documents 
            SET status = 'REJECTED',
                current_approvers = 0,
                is_required_approvers_left = 0
            WHERE id = ?`;

          connection.query(updateDocQuery, [docId], (err, updateResult) => {
            connection.release();
            
            if(err) {
              console.error("Update error:", err);
              return res.status(500).json({ 
                message: "Failed to update document status",
                code: "500"
              });
            }

            res.status(200).json({
              message: "Document rejected successfully",
              code: "200"
            });
          });
        });
      });
    });
  } catch (error) {
    console.error("Unexpected error in rejectDoc:", error);
    res.status(500).json({
      message: "An unexpected error occurred",
      code: "500"
    });
  }    
}

module.exports = {
	getSubmittedDocs,
  getPendingDocs,
  approveDoc,
  rejectDoc,
  testSpeed
	// other controller functions if any
};
