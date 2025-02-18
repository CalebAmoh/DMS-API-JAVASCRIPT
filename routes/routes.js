const express = require("express"); //import express
const router = express.Router(); //create express router
const { checkApiKey } = require("../middleware/authMiddleware");
const userController = require("../controllers/users"); //users controller
const newsController = require("../controllers/news.js"); //news controller
const parameterController = require("../controllers/parameters.js"); //news controller
const approverSetupController = require("../controllers/approverSetups.js"); //approver setup controller
const approvalActivityController = require("../controllers/approvalActivity.js"); //approver setup controller
const dashboardController = require("../controllers/dashboard.js");
const accountController = require("../controllers/accountSetup.js");

const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() }); // Set the destination folder for uploaded files
// const addNewsMiddleware = upload.fields([
// 	{ name: "bannerImage", maxCount: 1 },
// 	{ name: "imageContent1", maxCount: 6 }
// 	// { name: "imageContent2", maxCount: 1 }
// ]); //

router.use(checkApiKey);

//index route just for testing
//returns hello world
router.get("/", (req, res) => {
	res.send("Hello World!");
});

/*******************************************
* AUTH ROUTES
*****************************************/

//user registration route to register users
router.post("/register", userController.register);
router.post("/login", userController.login);
router.get("/get-users-:user_id", userController.getUsers);
router.post("/delete-user", userController.deleteUser);
router.post("/logout", userController.logoutUser);
router.post("/update-user", userController.updateUser);
router.post("/update-password", userController.changeUserPassword);
router.post("/get-user", userController.getUser);


router.get("/get-generated-docs", newsController.getGeneratedDocs);

//parameter routes
router.get("/get-doc-types", parameterController.getDoctypes);
router.get("/get-available-doc-types", parameterController.getAvailableDoctypes);

//approver setups
router.get("/get-approver-setups", approverSetupController.getApproverSetups);
router.get("/get-approver-users", approverSetupController.getApproverUsers);

//approval activity routes
router.get("/get-submitted-docs", approvalActivityController.getSubmittedDocs);
router.post("/get-pending-docs", approvalActivityController.getPendingDocs);
router.put("/approve-doc", approvalActivityController.approveDoc);
router.put("/reject-doc", approvalActivityController.rejectDoc);

//dashboard
router.get("/get-dashbaord-stats", dashboardController.getDashboardValues);


//account routes
router.get("/get-all-accounts", accountController.getAllAccounts);

router.all("*", (req, res) => {
	res.status(403).json({ code: "404", message: "route not found" });
});
module.exports = router;
