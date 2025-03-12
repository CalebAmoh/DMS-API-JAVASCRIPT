const mysql = require("mysql");

// Create a connection to the database
const connection = mysql.createConnection({
  host: "127.0.0.1",
  user: "root",
  password: "",
  database: "dms_db",
});

const pool = mysql.createPool({
  connectionLimit: 10, // Maximum connections in the pool
  host: "127.0.0.1",
  user: "root",
  password: "",
  database: "dms_db",
});

// const pool = mysql.createPool({
//   connectionLimit: 10, // Maximum connections in the pool
//   host: "104.243.44.92",
//   user: "kelishu9_Godfrey",
//   password: "57mm@PDc[]C;",
//   database: "kelishu9_data_packages",
// });



module.exports = connection;
module.exports = pool;
