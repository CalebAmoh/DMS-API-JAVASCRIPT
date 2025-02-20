//IMPORTS
require("dotenv").config();

const cookieParser = require("cookie-parser");
const express = require("express");
const cors = require("cors");



//create express app and get port for connection
const app = express(); //create express app
const port = process.env.PORT || 4000; //port for serve

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(cors());

//base route for the app
app.use("/v1/api/dms", require("./routes/routes"));

//server connection
app.listen(port, () => {
	console.log(`Example app listening on port ${port}`);
});
