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



module.exports = {
	getApproverSetups,
    getApproverUsers,
    testSpeed
	// other controller functions if any
};
