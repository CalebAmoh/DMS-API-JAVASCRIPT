const helper = require("./helper"); //access helper functions
require("dotenv").config();
const documentTypesCollection = "code_creation_details";
const usersCollection = "users";
const pool = require("../mysqlconfig")

/***********************************************************************************************************
 * handles all parameter creation and all parameter related activity in the app
 * 
 * Activities in {
	* getDocTypes() - get all the document types,
	* getDocType() -  get the details of a single document,
 * }
 ***************************************************************************************************************/

//just for testing of api speed
const testSpeed = async (req, res) => {
	console.log("testing api");
	res.status(200).json({ result: "ok 1" });
	// return;
};

const getDoctypes = async (req, res) => {
	try {
		const query = `SELECT c.id,c.description,c.trans_type,c.expense_code,c.status,code_creations.code as code FROM code_creation_details c JOIN code_creations ON code_creations.id = 2 where c.code_id =2;`;
	  // const query = `
	  // SELECT c.id, c.description, c.trans_type, c.expense_code, c.status, 
	  // 	   code_creations.code as code 
	  // FROM code_creation_details c
	  // JOIN code_creations ON code_creations.id = 1
	  // WHERE c.code_id = 1
	  // AND NOT EXISTS (
	  //   SELECT 1 FROM doc_approval_setups 
	  //   WHERE doctype_id = c.id
	  // )`;
	  
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

//returns all the document types
const getParameters = async (req,res)=> {
	try{
		//get all document types
		const doctypes = await helper.selectRecordsWithCondition(documentTypesCollection, [{code_id: "2"}]);
		const users = await helper.selectRecordsWithQuery('select * from users');

		res.status(200).json({result:{doctypes,users}, code:"200"})
	}catch(error){
		console.log(error);
		res.status(500).json({result: "Failed to get parameters", code: "500"});
	}
}


const getCodeDetails = async (req,res)=> {
	try{
		//get all document types
		query = `SELECT d.id,d.code_id,d.description,d.status,d.trans_type,d.expense_code,c.code FROM code_creation_details d join code_creations c on c.id = 1 WHERE d.id = ?`;
		
		const docDetails = await helper.selectRecordsWithQuery(query,[req.params.codeId]);

		if(docDetails.status === "success"){
			res.status(200).json({result:docDetails.data, code:"200"})
		}else{
			res.status(404).json({result:docDetails.message, code:"404"})
		}
	}catch(error){
		console.log(error);
		res.status(500).json({result: "Failed to get parameters", code: "500"});
	}
}

//returns available document types
const getAvailableDoctypes = async (req, res) => {
	try {
		//   const query = `SELECT c.id,c.description,c.trans_type,c.expense_code,c.status,code_creations.code as code FROM code_creation_details c JOIN code_creations ON code_creations.id = 2 where c.code_id =2;`;
		const query = `
		   SELECT c.id, c.description, c.trans_type, c.expense_code, c.status, 
			   code_creations.code as code 
		   FROM code_creation_details c
		   JOIN code_creations ON code_creations.id = 2
		   WHERE c.code_id = 2
		   AND NOT EXISTS (
		   SELECT 1 FROM doc_approval_setups 
		   WHERE doctype_id = c.id
		   )`;
	   
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
	getDoctypes,
	getParameters,
	getCodeDetails,
	getAvailableDoctypes,
    testSpeed
	// other controller functions if any
};
