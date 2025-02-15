const helper = require("./helper"); //access helper functions
require("dotenv").config();
const pool = require("../mysqlconfig");

/***********************************************************************************************************
 * handles all approver setups and all related activity in the app
 * 
 * Activities in {
	* getAllAccounts() - get all accounts,
 * }
 ***************************************************************************************************************/

//just for testing of api speed
const testSpeed = async (req, res) => {
	console.log("testing api");
	res.status(200).json({ result: "ok 1" });
	// return;
};

//returns all accounts
const getAllAccounts = async (req, res) => {
	try {
        const query = `SELECT * from account_setups;`;
    
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
                accounts: results,
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
	getAllAccounts,
    testSpeed
	// other controller functions if any
};
