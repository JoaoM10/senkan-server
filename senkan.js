var express         = require('express');
var cors            = require('cors');
var bodyParser      = require('body-parser');
var multer          = require('multer'); 
var morgan          = require('morgan');
var mysql           = require('mysql');
var validator       = require('validator');
var bcrypt          = require('bcrypt');
var paramsValidator = require('./params-validator');
var game            = require('./game');


// HTTP SERVER -----------------------------------------------------------


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


var app = express();

app.use(cors()); // Enable CORS
app.use(morgan('combined')); // Logging
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(multer()); // for parsing multipart/form-data


// ROUTING --------------------------------

// POST ---------------------

app.post('/ranking', function (req, res) {
  handleRanking(res);
});

app.post('/register', function (req, res) {
  handleRegister(res, req.body);
});

app.post('/join', function (req, res) {
  handleJoin(res, req.body);
});

app.post('/notify', function (req, res) {
  handleNotify(res, req.body);
});    

app.post('/leave', function (req, res) {
  handleLeave(res, req.body);
});

app.post('*', function (req, res) { // Default (unknown function)
  contentDeliver(res, { error: 'Unknown function ' + req.params.unknown });
});

// GET ----------------------

app.get('/update', function (req, res) {
  handleUpdate(res, req.query);
});

app.get('*', function (req, res) { // Default (unknown function)
  contentDeliver(res, { error: 'Unknown function ' + req.params.unknown });
});

// END OF ROUTING -------------------------


app.listen(TCPport, function () {
  console.log('Senkan server listening on port ' + TCPport);
});


// HANDLERS --------------------------------------------------------------


var games = []; // Save info of all games
var gamesWaiting = []; // Games (id only) waiting for second player
var playerGame = []; // Game room where players are
var gameState = []; // Save the state of the game (waiting, playing, finished)


// Obtain ranking from DB and deliver it to the user
function handleRanking (res) {

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


// Register/Login user
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
function handleRegister (res, params) {
  authenticate(res, params.name, params.pass, function (resAuth) {
    if (resAuth)
      contentDeliver(res, {});
  });
}


// Join the player to the game (may need to create a new one)
function handleJoin (res, params) {

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
    var playerKey, gameInfo, gameId;
    
    var gameId = gamesWaiting.pop();
    while (gameId !== undefined && gameState[gameId] === 'aborted')
      gameId = gamesWaiting.pop();
    
    if (gameId === undefined) { // No players waiting
      gameInfo = game();

      gameInfo.addPlayer(name, board);
      playerKey = gameInfo.getPlayerInfo(0).key;
      playerGame[name] = { gameId: gameInfo.id, key: playerKey };

      games[gameInfo.id] = gameInfo;
      gameState[gameInfo.id] = 'waiting';
      gamesWaiting.push(gameInfo.id);
      
      console.log('Created new game: ' + gameInfo.id);
    }
    else {
      gameInfo = games[gameId];
      
      if (gameInfo.getPlayerInfo(0).name !== name) { // Don't allow games with himself
        gameInfo.addPlayer(name, board);
        playerKey = gameInfo.getPlayerInfo(1).key;
        playerGame[name] = { gameId: gameInfo.id, key: playerKey };

        gameState[gameInfo.id] = 'ready';
        
        console.log('Game ' + gameInfo.id + 'has both players now!');
      }
      else {
        playerKey = gameInfo.getPlayerInfo(0).key;
        gamesWaiting.push(gameInfo.id);
      }
    }
      
    contentDeliver(res, { game: gameInfo.id, key: playerKey });  
    
  });
};


// Player connected to a game (SSE)
function handleUpdate (res, params) {
};


// Receive a shot on a game
function handleNotify (res, params) {
};


// Player left a game
function handleLeave (res, params) {

  var name = params.name;
  var gameId = params.game;
  var gameKey = params.key;
  
  // Verify parameters received
  var playerInfo = playerGame[name];
  if (playerInfo === undefined || playerInfo.gameId !== gameId || playerInfo.key !== gameKey) {
    contentDeliver(res, { error: 'Invalid leave request.' });
    return;
  }

  // Check if the game is on waiting list (cannot leave after the game started)
  if (gameState[gameId] !== 'waiting') {
    contentDeliver(res, { error: 'Cannot leave the game!' });
    return;
  }
  
  // Now he can leave the game
  gameState[gameId] = 'aborted';
  games[gameId] = undefined;
  playerGame[name] = undefined;

  contentDeliver(res, {});
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
