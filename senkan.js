var connect = require('connect');
var connectRoute = require('connect-route');
var bodyParser = require('body-parser');
var morgan = require('morgan');
var mysql = require('mysql');

if(process.argv.length < 3) {
  console.log('No TCP port defined!');
  console.log('Usage: node senkan <port>');
  process.exit(1);
}

var TCPport = Number(process.argv[2]);

var conn = mysql.createConnection({
  host: 'localhost',
  user: 'senkan',
  password: 'randompwhere',
  database: 'senkan',
  connectionLimit: 73
});


var app = connect();

app
  .use(morgan('combined'))
  .use(bodyParser.urlencoded({ extended: false }))
  .use(bodyParser.json())
  .use(connectRoute(function (router) {

    // Deliver the ranking
    router.post('/ranking', function (req, res, next) {
      var ranking = {ranking: [{name: 'joaom', shots: '42'}, {name: 'joao', shots: '73'}]};
      // get ranking
      res.writeHeader(200, {'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*'});
      res.end(JSON.stringify(ranking));
    });

    // Deal with registration and login
    router.post('/register', function (req, res, next) {
      var result = {};
      // try register/login
      res.writeHeader(200, {'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*'});
      res.end(JSON.stringify(result));
    });

    // Match other (invalid) functions
    router.post(':unknown', function (req, res, next) {
      res.writeHeader(200, {'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*'});
      res.end(JSON.stringify({error: 'Unknown function ' + req.params.unknown}));
    });
    
  }));

app.listen(TCPport);
