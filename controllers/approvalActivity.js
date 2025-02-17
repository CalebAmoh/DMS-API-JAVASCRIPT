const helper = require("./helper"); //access helper functions
require("dotenv").config();
const pool = require("../mysqlconfig");

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
    const { docId, userId, remarks } = req.body;

    // Validate required parameters
    if (!docId || !userId) {
      return res.status(400).json({
        message: "Missing required parameters",
        code: "400"
      });
    }

    // First query to get current document status and approval stage
    const getDocQuery = `SELECT rd.current_approvers,rd.doctype_id,rd.status, rd.approval_stage,count(a.doctype_id) max_approval_level 
                        FROM request_documents rd 
                        join doc_approval_setups a ON a.doctype_id = rd.doctype_id  
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

        const document = docResults[0];
        let approvalStage = parseInt(document.approval_stage);
        let current_approvals = document.current_approvers === null ? 0 : parseInt(document.current_approvers);

        console.log("document's current approvalStage",approvalStage);

        //get the number of approvers of that level
        const getCurrentLevelApproversCount = `SELECT (SELECT COUNT(*) FROM doc_approvers WHERE doctype_id = ? AND approval_stage = ?) as all_approvers`;
        connection.query(getCurrentLevelApproversCount, [document.doctype_id, approvalStage], (err, docResults) => {
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

          const doc = docResults[0];
          let countAllApprovers = parseInt(doc.all_approvers);

          //get the number of people who are required to approve the document
          const getCurrentLevelNonRequiredApproversCount = `SELECT (SELECT COUNT(*) FROM doc_approvers WHERE doctype_id = ? AND approval_stage = ? AND is_mandatory = ?) as non_required_approvers`;

          connection.query(getCurrentLevelNonRequiredApproversCount, [doc.doctype_id, approvalStage, 0], (err, docResults) => {
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

            const doc = docResults[0];
            let countNonRequiredApprovers = parseInt(doc.non_required_approvers);

            //get the number of people who have approved the document on the current level
            const getCurrentLevelApprovedApproversCount = `SELECT (SELECT current_approvers from request_documents where id = ?) as approved_approvers`;

            connection.query(getCurrentLevelApprovedApproversCount, [docId], (err, docResults) => {
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

              const doc = docResults[0];

              let countApprovedApprovers = parseInt(doc.approved_approvers);
              console.log("total approved approvers",countApprovedApprovers);

              //get quorum for the document approval level
              const getQuorum = `SELECT (SELECT quorum FROM doc_approval_setups WHERE doctype_id = ? AND approval_stage = ?) as quorum`;

              console.log("approvalStage",doc.doctype_id);
              console.log("approvalStage",approvalStage);
              connection.query(getQuorum, [document.doctype_id, approvalStage], (err, docResults) => {
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

                const doc = docResults[0];

                let quorum = parseInt(doc.quorum);
                console.log("quorum",quorum);

                //get the approver's who are required to approve that have approved the document
                const getApproversWhoHaveApproved = `SELECT (SELECT COUNT(*) FROM approval_activities WHERE doc_id = ?  AND approved_by IN (SELECT approver_id FROM doc_approvers WHERE doctype_id = ? AND approval_stage = ? AND is_mandatory = ?)) as non_required_approvers_approved`;

                connection.query(getApproversWhoHaveApproved, [docId, doc.doctype_id, approvalStage, 0], (err, docResults) => {
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

                  const doc = docResults[0];

                  let countNonRequiredApproversApproved = parseInt(doc.non_required_approvers_approved);

                  //check if the imcoming user is required to approve the document
                  const isApproverRequired = `select count(*) as is_approver_required from doc_approvers where doctype_id = ? and approval_stage = ? and approver_id = ? and is_mandatory = ?`;

                  connection.query(isApproverRequired, [doc.doctype_id, approvalStage, userId, 1], (err, docResults) => {
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

                    const doc = docResults[0];

                    let isApproverRequired = parseInt(doc.is_approver_required);


                    
                    //if user is required to approve the document check if the user will complete the required approvers
                    let isRequiredApproversLeft = 1;
                    if(isApproverRequired !== 1){
                      const willCompleteRequiredApprovers = (countNonRequiredApproversApproved + 1) >= countNonRequiredApprovers;
                      isRequiredApproversLeft = willCompleteRequiredApprovers ? 1 : 0;
                    }

                    //increment the approval stage if the required number of approvers have approved the document
                    const willCompleteStage = (countApprovedApprovers + 1) >= quorum;
                    const newApprovalStage = willCompleteStage ? approvalStage + 1 : approvalStage; //if the stage is complete, increment the stage
                    const current_approvers = willCompleteStage ? 0 : current_approvals+1; //if the stage is complete, reset the current approvers to 0
                    isRequiredApproversLeft = willCompleteStage ? 0 : isRequiredApproversLeft; //if the stage is complete, reset the isRequiredApproversLeft to 0
                    const isFullyApproved = newApprovalStage > document.max_approval_level;
                    const newStatus = isFullyApproved ? 'APPROVED' : 'PENDING';

                    // Add this query before calculating willCompleteStage
                    const getMandatoryApproversCount = `SELECT COUNT(*) as mandatory_count 
                                                          FROM doc_approvers 
                                                          WHERE doctype_id = ? 
                                                          AND approval_stage = ? 
                                                          AND is_mandatory = 1`;

                    connection.query(getMandatoryApproversCount, [document.doctype_id, newApprovalStage], (err, mandatoryResults) => {
                      if (err) {
                        connection.release();
                        console.error("Error fetching mandatory approvers count:", err);
                        return res.status(500).json({
                          message: "Failed to fetch mandatory approvers details",
                          code: "500"
                        });
                      }

                      const mandatoryCount = mandatoryResults[0].mandatory_count;

                      // Modify the logic for isRequiredApproversLeft
                      isRequiredApproversLeft = willCompleteStage ? (mandatoryCount >= quorum ? 1 : 0) : isRequiredApproversLeft;

                      // Modified approval query to include approval_stage
                      const approvalQuery = `INSERT INTO approval_activities 
                                (doc_id, approved_by, comment, approval_stage) 
                                VALUES (?, ?, ?, ?)`;

                      // Insert approval record with current approval stage
                      connection.query(approvalQuery, [docId, userId, remarks, approvalStage], (err, approvalResult) => {
                        if (err) {
                          connection.release();
                          console.error("Error recording approval:", err);
                          return res.status(500).json({ 
                            message: "Failed to record approval",
                            code: "500"
                          });
                        }

                        // Update document status
                        const updateDocQuery = `
                          UPDATE request_documents 
                          SET status = ?, 
                              approval_stage = ?,
                              current_approvers = ?,
                              is_required_approvers_left = ?
                          WHERE id = ?`;

                        console.log("Update parameters:", {
                          newStatus,
                          newApprovalStage,
                          current_approvers,
                          isRequiredApproversLeft,
                          docId
                        });

                        connection.query(updateDocQuery, 
                          [newStatus, newApprovalStage, current_approvers,isRequiredApproversLeft, docId],
                          (err, updateResult) => {
                            connection.release();
                            
                            if(err) {
                              console.error("Update error:", err);
                              return res.status(500).json({ 
                                message: "Failed to update document status",
                                code: "500"
                              });
                            }
                            if(updateResult) {
                              console.log("Update success:", updateResult);
                            }

                            //if document is fully approved, return message
                            if(isFullyApproved === "APPROVED"){

                            }

                            res.status(200).json({
                              message: isFullyApproved ? 
                                "Document fully approved" : 
                                "Document approved and moved to next stage",
                              code: "200"
                            });
                        });
                      });
                    });
                  });

                });
              });
            });
          });
        });  
      });
    });

  } catch (error) {
    console.error("Unexpected error in approveDoc:", error);
    res.status(500).json({
      message: "An unexpected error occurred",
      code: "500"
    });
  }
};

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
