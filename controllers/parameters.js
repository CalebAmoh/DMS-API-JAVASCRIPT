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
	* getParameters() - get all the parameters in the app,
	* addDoctype() - add a new document type,
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
		   WHERE c.code_id = 2 AND status = 1
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

/**
 * Get all document types that have approval setups
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} JSON response with document types and their approval setups
 */
const getDoctypesWithApprovalSetups = async(req, res) => {
    try {
        const query = `SELECT ccd.* FROM code_creation_details ccd JOIN (SELECT DISTINCT doctype_id FROM doc_approval_setups) das ON ccd.id = das.doctype_id;`;

        //getDocs 
		const getDocs = await helper.selectRecordsWithQuery(query);
		console.log(getDocs);
		getDocs.status === "success" ? (res.status(200).json({results:getDocs.data,status:"200"})):(res.status(400).json({message:"Failed to retrieve document types",status:"400"}))

    } catch (error) {
        console.error("Error in getDoctypesWithApprovalSetups:", error);
        return res.status(500).json({
            message: "An unexpected error occurred",
            code: "500"
        });
    }
};

//add document type
const addDoctype = async (req, res) => {
	try{
		const {description,status,trans_type,expense_code,posted_by} = req.body;

		//required data
		const dataEntry = [
			{name:"Description", value:description},
			{name:"Status", value:status},
			{name:"Transaction type", value:trans_type},
			{name:"USer", value:posted_by}
		];

		// Check for null or empty values from data entry
		const result = await helper.checkForNullOrEmpty(dataEntry);
		if (result.status !== "success") {
			return res.status(203).json({ result: result.message, code: "203" });
		}

		//check if document type already exists
		const doctype = await helper.selectRecordsWithCondition(documentTypesCollection, [{description:description}]);
		if(doctype.status === "success"){
			return res.status(400).json({message:"Document type already exists", code:"400"})
		}

		//data to be inserted
		const data = {
			description: description,
			status,
			trans_type,
			code_id: 2,
			expense_code,
			posted_by
		}

		//insert data into the database
		const insertDoctype = await helper.dynamicInsert(documentTypesCollection, data);
		if(insertDoctype.status === "success"){
			res.status(200).json({message:"Document type added successfully", code:"200"})
		}else{
			res.status(400).json({message:insertDoctype.message, code:"400"})
		}
	}catch(error){
		console.log(error);
		res.status(500).json({message: "Failed to add document type", code: "500"});
	}
}

//update the document type
const updateDoctype = async (req, res) => {
	try{
		const {description,trans_type,status,expense_code,id,posted_by} = req.body;

		dataEntry = [
			{name:"Description", value:description},
			{name:"Transaction type", value:trans_type},
			{name:"Status", value:status},
		]

		// Check for null or empty values from data entry
		const result = await helper.checkForNullOrEmpty(dataEntry);
		if (result.status !== "success") {
			return res.status(203).json({ message: result.message, code: "203" });
		}

		//check if document type already exists
		const doctype = await helper.selectRecordsWithCondition(documentTypesCollection, [{id:id}]);
		if(doctype.status !== "success"){
			return res.status(404).json({message:"Document type does not exist", code:"404"})
		}

		//data to be inserted
		const data = {
			description,
			status,
			trans_type,
			expense_code,
			posted_by,
			code_id:2
		}

		//update record
		const updateDocType = await helper.dynamicUpdateWithId(documentTypesCollection,data,id);
		updateDocType.status === "success" ? res.status(200).json({message:"Document updated successfully", code:"200"}):res.status(203).json({message:"Failed to update document",code:"203"});
	}catch(error){
		console.log(error);
		res.status(500).json({message: "Failed to update document type", code: "500"});
	}
}



module.exports = {
	getDoctypes,
	getParameters,
	getCodeDetails,
	getAvailableDoctypes,
	getDoctypesWithApprovalSetups,
	addDoctype,
	updateDoctype,
    testSpeed
	// other controller functions if any
};
