//IMPORTS
require("dotenv").config();

const cookieParser = require("cookie-parser");
const express = require("express");
const cors = require("cors");
const credentials = require("./middleware/credentials");
const corsOptions = require("./middleware/corsOption");



//create express app and get port for connection
const app = express(); //create express app
const port = process.env.PORT || 4000; //port for serve
app.use(credentials);
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

//base route for the app
app.use("/v1/api/dms", require("./routes/routes"));

//server connection
app.listen(port, () => {
	console.log(`Example app listening on port ${port}`);
});
