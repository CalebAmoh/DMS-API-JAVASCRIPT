const helper = require("./helper");
const documentCollection = "request_documents";
require("dotenv").config();

/***********************************************************************************************************
 * documentController handles all document activities and any other user-related activity in the app
 * 
 * Activities include {
	* generateDoc() - generate a document,
    * getGeneratedDocs() - get all generated documents,
    * getDocById() - get all documents for a user,
    * updateDoc() - update a document,
    * submitDoc() - changes document status to submitted
    * 
 * }
 * 
 ***************************************************************************************************************/

//generate a document
const generateDoc = async (req,res) => {
    try  {
        const {doctype_id,requested_amount,customer_number,details,doc_id,user_id} = req.body;

        //pass data entry into array
        const dataEntry = [
            { name: "Document type", value: doctype_id },
            // { name: "Requested amount", value: requested_amount },
            // { name: "Customer number", value: customer_number },
            { name: "Details", value: details },
            { name: "Document number", value: doc_id },
            { name: "User", value: user_id }
        ];

        //check for null or empty values from data entry
        const result = helper.checkForNullOrEmpty(dataEntry);

        if(result.status === "success"){
            // Check for unique values
            const isUnique = await helper.checkUniqueColumn(documentCollection, [{"doc_id":doc_id}]);
            if (isUnique.status === "error") {
                return res.status(409).json({ result: isUnique.message, code: "409" });
            }

            const data = {
                doctype_id: doctype_id,
                requested_amount: requested_amount,
                customer_no: customer_number,
                details: details,
                doc_id: doc_id,
                posted_by: user_id,
                branch:"000"
            }

            //insert data into the database
            const insertDoc = await helper.dynamicInsert(documentCollection, data);
            if(insertDoc.status === "success") {
                res.status(201).json({ result: "Document generated successfully", code: "201" });
            }else{
                console.log("Error:",insertDoc.message);
                res.status(400).json({ result: insertDoc.message, code: "400" });
            }
        }else{
            res.status(400).json({ result: result.message, code: "400" });
        }

    }catch(error) {
        console.log("Unexpected error:",error);
        res.status(500).json({error:"Failed to generate document"})
    }
}

const getGeneratedDocs = async (req, res) => {
	try {
	  const query = `SELECT  request_documents.*, doctype_details.description AS doctype_name
						FROM request_documents
	JOIN code_creation_details AS doctype_details
		ON request_documents.doctype_id = doctype_details.id
		AND doctype_details.code_id = 2;`;
	//   const query = `SELECT  request_documents.*, doctype_details.description AS doctype_name
	// 					FROM request_documents
	// JOIN code_creation_details AS doctype_details
	// 	ON request_documents.doctype_id = doctype_details.id
	// 	AND doctype_details.code_id = 2
	// WHERE 
	// 	request_documents.posted_by = 1;`;
        
    const docs = await helper.selectRecordsWithQuery(query);
    if(docs.status === "success"){
        res.status(200).json({result:docs.data, code:"200"})
    }else{
        res.status(404).json({result:docs.message, code:"404"})
    }

	} catch (error) {
	  console.error("Unexpected error: ", error);
	  res.status(500).json({ error: "An unexpected error occurred." });
	}
};

//get document by id
const getDocById = async (req,res) => {
    try {

        query = `SELECT request_documents.*, 
       doctype_details.description AS doctype_name FROM request_documents JOIN code_creation_details AS doctype_details ON request_documents.doctype_id = doctype_details.id AND doctype_details.code_id = 2 WHERE request_documents.id = ? LIMIT 1;`

        const docDetails = await helper.selectRecordsWithQuery(query,[req.params.docId]);

        if(docDetails.status === "success"){
            expense_details_query = `SELECT * FROM account_setups where id = ?;`
            const expenseDetails = await helper.selectRecordsWithQuery(expense_details_query,[docDetails.data[0].doctype_id]);

            res.status(200).json({result:docDetails.data,expense_details:expenseDetails.data[0], code:"200"})
        }else{
            res.status(404).json({result:docDetails.message, code:"404"})
        }
        
    } catch (error) {
        console.log("Unexpected error:",error);
        res.status(500).json({error:"Failed to get document"})
    }
}

//update document
const updateDoc = async (req,res) => {
    try{
        const {doctype_id,requested_amount,customer_number,details,doc_id,user_id} = req.body;
        const dataEntry = [
            { name: "Document type", value: doctype_id },
            // { name: "Requested amount", value: requested_amount },
            // { name: "Customer number", value: customer_number },
            { name: "Details", value: details },
            { name: "Document number", value: doc_id },
            { name: "User", value: user_id }
        ];

        const result = helper.checkForNullOrEmpty(dataEntry);

        if(result.status === "success"){
            const data = {
                doctype_id: doctype_id,
                requested_amount: requested_amount,
                customer_no: customer_number,
                details: details,
                doc_id: doc_id,
                posted_by: user_id
            }

            const updateDoc = await helper.dynamicUpdateWithId(documentCollection, data,req.params.docId);
            if(updateDoc.status === "success") {
                res.status(200).json({ result: "Document updated successfully", code: "200" });
            }else{
                res.status(400).json({ result: updateDoc.message, code: "400" });
            }


        }else{
            res.status(400).json({ result: result.message, code: "400" });
        }
    }catch(error){
        console.log("Unexpected error:",error);
        res.status(500).json({error:"Failed to update document"})
    }
}

const submitDoc = async(req,res) => {
    try{
        const submitDoc = await helper.dynamicUpdateWithId(documentCollection,{status:"SUBMITTED"},req.params.docId);
        if(submitDoc.status === "success") {
            res.status(200).json({ result: "Document submitted successfully", code: "200" });
        }else{
            res.status(400).json({ result: submitDoc.message, code: "400" });
        }
       }catch(error){
        console.log("Unexpected error:",error);
        res.status(500).json({error:"Failed to submit document"})
    }
}

module.exports = {
    generateDoc,
    getDocById,
    getGeneratedDocs,
    updateDoc,
    submitDoc
}