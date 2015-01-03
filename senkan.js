var connect = require('connect');
var connectRoute = require('connect-route');
var bodyParser = require('body-parser');
var morgan = require('morgan');
var mysql = require('mysql');
var validator = require('validator');
var paramsValidator = require('./params-validator');


// Receive TCP port where server should listen
if(process.argv.length < 3) {
  console.log('No TCP port defined!');
  console.log('Usage: node senkan <port>');
  process.exit(1);
}
var TCPport = Number(process.argv[2]);


// Create pool of connections do MySQL DB
var DBpool = mysql.createConnection({
  host: 'localhost',
  user: 'senkan',
  password: 'randompwhere',
  database: 'senkan',
  connectionLimit: 73
});


var app = connect();
app
  .use(morgan('combined')) // Logging
  .use(bodyParser.urlencoded({ extended: false }))
  .use(bodyParser.json())
  .use(connectRoute(function (router) {

    
    // Deliver the ranking
    router.post('/ranking', function (req, res, next) {
      var result = getRanking();
      res.writeHeader(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(result));
    });

    
    // Deal with registration and login
    router.post('/register', function (req, res, next) {
      res.writeHeader(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });

      // Must check credential's format first
      var valCredentials = paramsValidator.credentials(req.body.name, req.body.pass);
      if (valCredentials !== undefined) {
        res.end(JSON.stringify({ error: valCredentials }));
        return;
      }

      // Parameters have the right format, so try to register/login
      var name = req.body.name;
      var password = req.body.pass;
      var result = ''; //register(name, password);
      res.end(JSON.stringify(result));
    });

    
    // Match other (invalid) functions
    router.post(':unknown', function (req, res, next) {
      res.writeHeader(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: 'Unknown function ' + req.params.unknown }));
    });

    
  }))
  .use(function (err, req, res, next) {
    console.log(err);
    next();
  });
app.listen(TCPport);


// Obtain ranking from DB
function getRanking () {
  
  DBpool.getConnection(function (err, conn) {
    
    if (err) {
      console.log('Error on DB connection: ' + err);
      return { error: 'Error obtaining ranking! Try again...' }
    }
    
    conn.query('SELECT users.name as name, ranking.shots as shots FROM ranking INNER JOIN users ON ranking.user = users.user_id ORDER BY shots, created_at LIMIT 10', function (err, rows) {

      if (err) {
        console.log('Error on query the DB: ' + err);
        return { error: 'Error obtaining ranking! Try again...' }
      }
      
      conn.release();

      var rankingList = [];
      for (var i = 0; i < rows.length; i ++)
        rankingList.push({ name: rows[i].name, shots: rows[i].shots });

      return { ranking: rankingList };
    });
               
  });
                       
};    
