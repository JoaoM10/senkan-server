var connect = require('connect');
var connectRoute = require('connect-route');
var bodyParser = require('body-parser');
var morgan = require('morgan');
var mysql = require('mysql');
var validator = require('validator');
var bcrypt = require('bcrypt');
var paramsValidator = require('./params-validator');
var game = require('./game');


// Receive TCP port where server should listen
if(process.argv.length < 3) {
  console.log('No TCP port defined!');
  console.log('Usage: node senkan <port>');
  process.exit(1);
}
var TCPport = Number(process.argv[2]);


var gamesWaiting = []; // Games waiting for second player


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


    // Join a new game
    router.post('/join', function (req, res, next) {
      join(res, req.body);
    });

    
    // Receive new shot on a game
    router.post('/notify', function (req, res, next) {
      notify(res, req.body);
    });

    
    // A player left the game
    router.post('/leave', function (req, res, next) {
      leave(res, req.body);
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
function authenticate (res, name, password, callback) {

  // Must check credential's format first
  var valCredentials = paramsValidator.credentials(name, password);
  if (valCredentials !== undefined) {
    contentDeliver(res, { error: valCredentials });
    return callback(false);
  }

  // Parameters have the right format, so try to register/login

  DBpool.getConnection(function (err, conn) {
    if (err) {
      errorDeliver(res, 'Error on DB connection: ' + err);
      return callback(false);
    }

    conn.beginTransaction(function (err) {
      if (err) {
        errorDeliver(res, 'Error on starting DB transaction: ' + err);
        return callback(false);
      }  

      conn.query('SELECT password, salt FROM users WHERE name = ? LIMIT 1', [name], function (err, rows) {
        if (err) {
          errorDeliver(res, 'Error on query the DB: ' + err);
          conn.rollback(function() { throw err; });
          return callback(false);
        }  

        if (rows.length === 0) { // Register

          // Generate salt and hash password
          bcrypt.genSalt(10, function (err, salt) {
            if (err) {
              errorDeliver(res, 'Error generating salt: ' + err);
              conn.rollback(function() { throw err; });
              return callback(false);
            }

            bcrypt.hash(password, salt, function (err, passwordHash) {
              if (err) {
                errorDeliver(res, 'Error hashing password: ' + err);
                conn.rollback(function() { throw err; });
                return callback(false);
              }

              // Insert user
              conn.query('INSERT INTO users(name, password, salt) VALUES (?, ?, ?)', [name, passwordHash, salt], function (err, result) {
                if (err) {
                  errorDeliver(res, 'Error on query the DB: ' + err);
                  conn.rollback(function() { throw err; });
                  return callback(false);
                } 

                conn.commit(function (err) {
                  if (err) {
                    errorDeliver(res, 'Error committing the DB transaction: ' + err);
                    conn.rollback(function() { throw err; });
                    return callback(false);
                  }         

                  conn.release();

                  console.log('New user: ' + name);
                  return callback(true);
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
              return callback(false);
            }         

            conn.release();

            // Hash password sent by user
            bcrypt.hash(password, salt, function (err, passwordHash) {
              if (err) {
                errorDeliver(res, 'Error hashing password: ' + err);
                return callback(false);
              }        

              // Compare passwords
              if (passwordHash === passwordHashOfficial)
                return callback(true);
              else{
                contentDeliver(res, {error: 'User ' + name + ' registered with a different password'});
                return callback(false);
              }
              
            });
          });
        }
      });
    });          
  });
};


// Deal with register/login (before entering a game)
function register (res, params) {
  authenticate(res, params.name, params.pass, function (resAuth) {
    if (resAuth)
      contentDeliver(res, {});
  });
}


// Join the player to the game (may need to create a new game)
function join (res, params) {

  authenticate(res, params.name, params.pass, function (resAuth) {
    if (!resAuth)
      return;

    var valBoard = paramsValidator.board(params.board);
    if (valBoard !== undefined) {
      contentDeliver(res, { error: valBoard });
      return false;
    }

    var name = params.name;
    var password = params.pass;
    var board = params.board;

    var gameInfo = gamesWaiting.pop();
    if (gameInfo === undefined) { // No players waiting, create new game
      gameInfo = game();
      gameInfo.addPlayer(name, board);
      gamesWaiting.push(gameInfo);
    }
    else if (gameInfo.getFirstPlayer().name !== name) { // Don't allow games with himself
      gameInfo.addPlayer(name, board);
    }
      
    contentDeliver(res, { game: gameInfo.id, key: gameInfo.key });  
    
  });
};


// Receive a shot on a game
function notify (res, params) {
};


// A player left the game
function leave (res, params) {
};


// Responsible for answering server errors
function errorDeliver (res, msg) {
  console.log(msg);
  res.writeHeader(500, {});
  res.end();
};


// Responsible for answering well performed requests
function contentDeliver (res, msg) {
  res.writeHeader(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(msg));
};
