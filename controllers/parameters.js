const helper = require("./helper"); //access helper functions
require("dotenv").config();
const documentTypesCollection = "code_creation_details";
const usersCollection = "users";

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



module.exports = {
	getParameters,
	getCodeDetails,
    testSpeed
	// other controller functions if any
};
