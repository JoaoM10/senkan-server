var connect = require('connect');
var connectRoute = require('connect-route');
var bodyParser = require('body-parser');
var morgan = require('morgan');
var mysql = require('mysql');
var validator = require('validator');
var bcrypt = require('bcrypt');
var paramsValidator = require('./params-validator');


// Receive TCP port where server should listen
if(process.argv.length < 3) {
  console.log('No TCP port defined!');
  console.log('Usage: node senkan <port>');
  process.exit(1);
}
var TCPport = Number(process.argv[2]);


// Create pool of connections do MySQL DB
var DBpool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
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
      ranking(res);
    });


    // Deal with registration/login
    router.post('/register', function (req, res, next) {
      register(res, req.body);
    });


    // Match other (invalid) functions
    router.post(':unknown', function (req, res, next) {
      contentDeliver(res, { error: 'Unknown function ' + req.params.unknown });
    });


  }))
  .use(function (err, req, res, next) {
    errorDeliver(res, err);
    next();
  });
app.listen(TCPport);


// Obtain ranking from DB
function ranking (res) {

  DBpool.getConnection(function (err, conn) {
    if (err) {
      errorDeliver(res, 'Error on DB connection: ' + err);
      return;
    }

    conn.query('SELECT users.name as name, ranking.shots as shots FROM ranking INNER JOIN users ON ranking.user = users.user_id ORDER BY ranking.shots, ranking.created_at LIMIT 10', function (err, rows) {
      if (err) {
        errorDeliver(res, 'Error on query the DB: ' + err);
        return;
      }

      conn.release();

      result = { ranking: rows };
      contentDeliver(res, result);
    });      
  });                
};    


// Register/Login into senkan
function register (res, params) {

  // Must check credential's format first
  var valCredentials = paramsValidator.credentials(params.name, params.pass);
  if (valCredentials !== undefined) {
    contentDeliver(res, { error: valCredentials });
    return;
  }

  // Parameters have the right format, so try to register/login
  var name = params.name;
  var password = params.pass;

  DBpool.getConnection(function (err, conn) {
    if (err) {
      errorDeliver(res, 'Error on DB connection: ' + err);
      return;
    }

    conn.beginTransaction(function (err) {
      if (err) {
        errorDeliver(res, 'Error on starting DB transaction: ' + err);
        return;
      }  

      conn.query('SELECT password, salt FROM users WHERE name = ? LIMIT 1', [name], function (err, rows) {
        if (err) {
          errorDeliver(res, 'Error on query the DB: ' + err);
          conn.rollback(function() { throw err; });
          return;
        }  

        if (rows.length === 0) { // Register

          // Generate salt and hash password
          bcrypt.genSalt(42, function (err, salt) {
            if (err) {
              errorDeliver(res, 'Error generating salt: ' + err);
              conn.rollback(function() { throw err; });
              return;
            }

            bcrypt.hash(password, salt, null, function (err, passwordHash) {
              if (err) {
                errorDeliver(res, 'Error hashing password: ' + err);
                conn.rollback(function() { throw err; });
                return;
              }

              // Insert user
              conn.query('INSERT INTO users(name, password, salt) VALUES (?, ?, ?)', [name, passwordHash, salt], function (err, result) {
                if (err) {
                  errorDeliver(res, 'Error on query the DB: ' + err);
                  conn.rollback(function() { throw err; });
                  return;
                } 

                conn.commit(function (err) {
                  if (err) {
                    errorDeliver(res, 'Error committing the DB transaction: ' + err);
                    conn.rollback(function() { throw err; });
                    return;
                  }         

                  conn.release();

                  console.log('New user!');
                  contentDeliver(res, '');
                });
              });              
            });
          });
        }
        else { // Login

          var passwordHashOfficial = rows[0].password;
          var salt = rows[0].salt;

          conn.commit(function (err) {
            if (err) {
              errorDeliver(res, 'Error committing the DB transaction: ' + err);
              conn.rollback(function() { throw err; });
              return;
            }         

            conn.release();

            // Hash password sent by user
            bcrypt.hash(password, salt, function (err, passwordHash) {
              if (err) {
                errorDeliver(res, 'Error hashing password: ' + err);
                return;
              }        

              // Compare passwords
              if (passwordHash === passwordHashOfficial)
                contentDeliver(res, '');
              else
                contentDeliver(res, {error: 'User ' + name + ' registered with a different password'});

            });
          });
        }
      });
    });          
  });
}


// Responsible for answering server errors
function errorDeliver (res, msg) {
  console.log(msg);
  res.writeHeader(500, {});
  res.end();
}


// Responsible for answering well performed requests
function contentDeliver (res, msg) {
  res.writeHeader(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(msg));
}
