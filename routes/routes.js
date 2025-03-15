const express = require("express"); //import express
const router = express.Router(); //create express router
const { checkToken,handleRefreshToken } = require("../middleware/authMiddleware");
const userController = require("../controllers/users"); //users controller
const newsController = require("../controllers/news.js"); //news controller
const parameterController = require("../controllers/parameters.js"); //news controller
const approverSetupController = require("../controllers/approverSetups.js"); //approver setup controller
const approvalActivityController = require("../controllers/approvalActivity.js"); //approver setup controller
const dashboardController = require("../controllers/dashboard.js");
const accountController = require("../controllers/accountSetup.js");
const documentController = require("../controllers/document.js");

const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() }); // Set the destination folder for uploaded files


//index route just for testing
//returns hello world
router.get("/", (req, res) => {
	res.send("Hello World!");
});

/*******************************************
* AUTH ROUTES
*****************************************/
//group all user routes together to checkToken

//user registration route to register users
router.post("/user/login", userController.login);
router.get("/user/logout", userController.logout);
router.get("/user/refresh-token", handleRefreshToken);

router.use(checkToken);
router.post("/user/register", userController.register);
router.get("/get-users", userController.getUsers);
router.get("/get-users-roles", userController.getUserRoles);
// router.post("/delete-user", userController.deleteUser);
router.post("/user/logout", userController.logout);
router.get("/get-user:userId", userController.getUser);
router.put("/update-user:userId", userController.updateUser);




//parameter routes
router.get("/get-parameters", parameterController.getParameters);
router.get("/get-code-creation-details:codeId", parameterController.getCodeDetails);
router.get("/get-doc-types", parameterController.getDoctypes);
router.get("/get-available-doc-types", parameterController.getAvailableDoctypes);
router.get("/get-doctype-with-approval-setup", parameterController.getDoctypesWithApprovalSetups);
router.post("/add-doc-type", parameterController.addDoctype);
router.put("/update-doc-type", parameterController.updateDoctype);

//approver setups
router.get("/get-approver-setups", approverSetupController.getApproverSetups);
router.get("/get-approver-users", approverSetupController.getApproverUsers);
router.post("/create-doc-approvers-setup", approverSetupController.createApproverSetup);
router.put("/update-doc-approvers-setup", approverSetupController.updateApproverSetup);

//approval activity routes
router.get("/get-submitted-docs", approvalActivityController.getSubmittedDocs);
router.post("/get-pending-docs", approvalActivityController.getPendingDocs);
router.put("/approve-doc", approvalActivityController.approveDoc);
router.put("/reject-doc", approvalActivityController.rejectDoc);


//document routes
router.post("/generate-doc", documentController.generateDoc)
router.put("/update-doc:docId", documentController.updateDoc)
router.get("/get-doc:docId", documentController.getDocById)
router.get("/get-generated-docs/:userId/:role", documentController.getGeneratedDocs);
router.get("/get-user-generated-docs", documentController.getGeneratedDocs);
router.put("/submit-doc:docId", documentController.submitDoc);

//dashboard
router.get("/get-dashbaord-stats", dashboardController.getDashboardValues);

//account routes
router.get("/get-all-accounts", accountController.getAllAccounts);
router.get("/get-all-active-accounts", accountController.getAllActiveAccounts);
router.post("/add-account", accountController.createAccount);
router.put("/update-account:accountId", accountController.updateAccount);

router.all("*", (req, res) => {
	res.status(403).json({ code: "404", message: "route not found" });
});
module.exports = router;
