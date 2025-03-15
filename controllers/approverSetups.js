const helper = require("./helper"); //access helper functions
const { prisma } = require("../prismaConfig");
require("dotenv").config();
const pool = require("../mysqlconfig");
const cache = require("memory-cache");
const connection = require("../mysqlconfig");
const newsCollection = "news";
const messageCollection = "messages";

/***********************************************************************************************************
 * handles all approver setups and all related activity in the app
 * 
 * Activities in {
	* getApproverSetups() - get all the approver setups,
	* getApproverUsers() - get all the users who are approvers,
	* createApproverSetup() - create an approval flow for documents 
	* updateApproverSetup() - update the approval flow for documents
 * }
 ***************************************************************************************************************/

//just for testing of api speed
const testSpeed = async (req, res) => {
	console.log("testing api");
	res.status(200).json({ result: "ok 1" });
	// return;
};

//returns all the document types
const getApproverSetups = async (req, res) => {
	try {
	  const query = `select DISTINCT(count(doctype_id)) approval_stages,doc_approval_setups.id,description,doctype_id,sum(number_of_approvers) number_of_approvers,sum(number_of_mandatory_approvers) mandatory_approvers,details from doc_approval_setups join code_creation_details ON code_creation_details.id = doc_approval_setups.doctype_id GROUP BY doctype_id`;
  
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
			  setups: results,
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

//returns all users with approver role
const getApproverUsers = async (req, res) => {
    //get all approvers
    const query = `SELECT users.id as userId,concat(users.first_name," ",users.last_name) as name,roles.name as role,
        CASE 
        WHEN users.status = 1 THEN 'Active'
        WHEN users.status = 0 THEN 'Inactive'
        ELSE users.status 
        END as status
        FROM users
        JOIN model_has_roles ON users.id = model_has_roles.model_id
        JOIN roles ON model_has_roles.role_id = roles.id WHERE roles.name = "approver"`;

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
                    approvers: results,
                    code: "200",
                });
            }

            // Release the connection back to the pool
            connection.release();
        });
    });
}

/**
 * Creates an approver setup for a document type
 * @param {Object} req - Request object containing doctype_id and stages
 * @param {Object} res - Response object
 * @returns {Object} JSON response with setup status
 */
const createApproverSetup = async (req, res) => {
    try {
        const { doctype_id, stages,posted_by } = req.body;

        // Validate required fields
        if (!doctype_id || !stages) {
            return res.status(400).json({
                message: 'document type and the number of stages are required',
                code: '400'
            });
        }

        const num_of_stages = stages.length;
        let approval_stage = 1;

        // Loop through each stage
        for (const stage of stages) {
            const stage_name = stage.name;
            const quorum = stage.quorum;
            const num_of_approvers = stage.approvers.length;
            
            // Count mandatory approvers
            let mandatory_approvers = 0;
            
            // Insert approvers for this stage
            for (const approver of stage.approvers) {
                if (approver.isMandatory) {
                    mandatory_approvers++;
                }

                // Insert into doc_approvers table
                const approverData = {
                    doctype_id: doctype_id,
                    approver_id: approver.userId,
                    is_mandatory: approver.isMandatory,
                    approval_stage: approval_stage
                };

                const approverResult = await helper.dynamicInsert('doc_approvers', approverData);
                if (approverResult.status !== 'success') {
                    return res.status(500).json({
                        message: 'Failed to create approver setup',
                        code: '500'
                    });
                }
            }

            // Insert stage setup
            const setupData = {
                doctype_id: doctype_id,
                approval_stage: approval_stage,
                stage_desc: stage_name,
                number_of_approvers: num_of_approvers,
                number_of_mandatory_approvers: mandatory_approvers,
                quorum: quorum,
                approvers: JSON.stringify(stage.approvers),
                details: JSON.stringify(stages),
                posted_by
            };

            const setupResult = await helper.dynamicInsert('doc_approval_setups', setupData);
            if (setupResult.status !== 'success') {
                return res.status(500).json({
                    message: 'Failed to create approval setup',
                    code: '500'
                });
            }

            approval_stage++;
        }

        return res.status(200).json({
            message: 'Approver setup created successfully',
            code: '200'
        });

    } catch (error) {
        console.error('Error in createApproverSetup:', error);
        return res.status(500).json({
            message: 'Failed to create setup',
            error: error.message,
            code: '500'
        });
    }
};

/**
 * Updates an existing approver setup for a document type
 * @param {Object} req - Request object containing doctype_id and stages
 * @param {Object} res - Response object
 * @returns {Object} JSON response with update status
 */
const updateApproverSetup = async (req, res) => {
    try {
        const { doctype_id, stages, posted_by } = req.body;

        // Validate required fields
        if (!doctype_id || !stages) {
            return res.status(400).json({
                message: 'document type and stages are required',
                code: '400'
            });
        }

        // Delete existing approvers
		data = {doctype_id: doctype_id}
        await helper.deleteRecordsWithCondition('doc_approvers', [data]);

        // Delete existing approval setups
        await helper.deleteRecordsWithCondition('doc_approval_setups', [data]);

        let approval_stage = 1;

        // Loop through each stage
        for (const stage of stages) {
            const stage_name = stage.name;
            const quorum = stage.quorum;
            const number_of_approvers = stage.approvers.length;
            
            // Count mandatory approvers
            let mandatory_approvers = 0;
            
            // Insert approvers for this stage
            for (const approver of stage.approvers) {
                if (approver.isMandatory) {
                    mandatory_approvers++;
                }

                // Insert into doc_approvers table
                const approverData = {
                    doctype_id,
                    approver_id: approver.userId,
                    is_mandatory: approver.isMandatory,
                    approval_stage
                };

                const approverResult = await helper.dynamicInsert('doc_approvers', approverData);
                if (approverResult.status !== 'success') {
                    return res.status(500).json({
                        message: 'Failed to update approver setup',
                        code: '500'
                    });
                }
            }

            // Insert stage setup
            const setupData = {
                doctype_id,
                stage_desc: stage_name,
                approval_stage,
                number_of_approvers,
                number_of_mandatory_approvers: mandatory_approvers,
                quorum,
                approvers: JSON.stringify(stage.approvers),
                details: JSON.stringify(stages),
                posted_by
            };

            const setupResult = await helper.dynamicInsert('doc_approval_setups', setupData);
            if (setupResult.status !== 'success') {
                return res.status(500).json({
                    message: 'Failed to update approval setup',
                    code: '500'
                });
            }

            approval_stage++;
        }

        return res.status(200).json({
            message: 'Approver setup updated successfully',
            code: '200'
        });

    } catch (error) {
        console.error('Error in updateApproverSetup:', error);
        return res.status(500).json({
            message: 'Failed to update setup',
            error: error.message,
            code: '500'
        });
    }
};

module.exports = {
	getApproverSetups,
    getApproverUsers,
    testSpeed,
    createApproverSetup,
    updateApproverSetup
	// other controller functions if any
};
