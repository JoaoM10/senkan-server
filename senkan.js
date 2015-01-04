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


// Create pool of connections to MySQL DB
var DBpool = mysql.createPool({
  host:            'localhost',
  user:            'root',
  password:        '',
  database:        'senkan',
  connectionLimit: 73
});


var app = express();

app.use(cors()); // Enable CORS
app.use(morgan('combined')); // Enable logs
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(multer());


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
  handleUpdate(req, res, req.query);
});

app.get('*', function (req, res) { // Default (unknown function)
  contentDeliver(res, { error: 'Unknown function ' + req.params.unknown });
});

// END OF ROUTING -------------------------


// Error handling
app.use(function (err, req, res, next) {
  errorDeliver(res, 'Error: ' + err);
  next();
});


app.listen(TCPport, function () {
  console.log('Senkan server listening on port ' + TCPport);
});


// HANDLERS --------------------------------------------------------------


var games = []; // Save info of all games
var gamesWaiting = []; // Games (id only) waiting for the second player
var playerGame = []; // Game room where players are (if any)


/**
 * Handle ranking - Get ranking and deliver it to the user
 */
function handleRanking (res) {

  DBpool.getConnection(function (err, conn) {
    if (err) {
      errorDeliver(res, 'Error on DB connection: ' + err);
      return;
    }

    var query = 'SELECT users.name as name, ranking.shots as shots';
    query += ' FROM ranking INNER JOIN users ON ranking.user = users.user_id';
    query += ' ORDER BY ranking.shots, ranking.created_at LIMIT 10';
    conn.query(query, function (err, rows) {
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


/**
 * Update ranking
 */
function updateRanking (name, shots) {
  
  DBpool.getConnection(function (err, conn) {
    if (err) {
      console.error('Error on DB connection: ' + err);
      return;
    }

    var queryId = 'SELECT user_id FROM users WHERE name = ? LIMIT 1';
    conn.query(queryId, [name], function (err, rows) {
      if (err) {
        console.error('Error on query the DB: ' + err);
        return;
      }

      var userId = rows[0].user_id;
      
      var queryIns = 'INSERT INTO ranking(user, shots) VALUES (?, ?)';
      conn.query(queryIns, [userId, shots], function (err, result) {
        if (err) {
          console.error('Error on query the DB: ' + err);
          return;
        }
        
        conn.release();
      });      
    });
  });
};


/**
 * Register/Login
 */
function authenticate (res, name, password, callback) {

  // Must check credential's format first
  var valCredentials = paramsValidator.credentials(name, password);
  if (valCredentials !== undefined) {
    contentDeliver(res, { error: valCredentials });
    return callback(false);
  }


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

      var queryG = 'SELECT password, salt FROM users WHERE name = ? LIMIT 1';
      conn.query(queryG, [name], function (err, rows) {
        if (err) {
          errorDeliver(res, 'Error on query the DB: ' + err);
          conn.rollback(function() { throw err; });
          return callback(false);
        }  

        if (rows.length === 0) { // Register

          // Generate salt and hash password (Blowfish encryption)
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

              var queryI = 'INSERT INTO users(name, password, salt) VALUES (?, ?, ?)';
              conn.query(queryI, [name, passwordHash, salt], function (err, result) {
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

            // Hash password sent by user to allow comparison
            bcrypt.hash(password, salt, function (err, passwordHash) {
              if (err) {
                errorDeliver(res, 'Error hashing password: ' + err);
                return callback(false);
              }        

              if (passwordHash === passwordHashOfficial)
                return callback(true);
              else{
                var errorPw = 'User ' + name;
                errorPw += ' registered with a different password';
                contentDeliver(res, {error: errorPw});
                return callback(false);
              }
              
            });
          });
        }
      });
    });          
  });
};


/**
 * Handle Register/Login
 */
function handleRegister (res, params) {
  authenticate(res, params.name, params.pass, function (resAuth) {
    if (resAuth)
      contentDeliver(res, {});
  });
};


/**
 * Handle join - Join the player to the game (may need to create a new room)
 */
function handleJoin (res, params) {

  // Verify all parameters received
  authenticate(res, params.name, params.pass, function (resAuth) {
    if (!resAuth)
      return;

    var valBoard = paramsValidator.board(params.board);
    if (valBoard !== undefined) {
      contentDeliver(res, { error: valBoard });
      return false;
    }

    // Join game

    var name = params.name;
    var password = params.pass;
    var board = params.board;
    var playerKey, gameInfo, gameId;
    
    // Check for any game on waiting
    // (lazy propagation removal of aborted games)
    var gameId = gamesWaiting.pop();
    while (gameId !== undefined && games[gameId].state === 'aborted')
      gameId = gamesWaiting.pop();
    
    if (gameId === undefined) { // No games on waiting, create a new game
      gameInfo = game();

      gameInfo.addPlayer(name, board);
      playerKey = gameInfo.getPlayerInfo(0).key;
      playerGame[name] = { gameId: gameInfo.id, key: playerKey };

      games[gameInfo.id] = gameInfo;
      gamesWaiting.push(gameInfo.id);
    }
    else {
      gameInfo = games[gameId];
      
      // Don't allow games with himself
      if (gameInfo.getPlayerInfo(0).name !== name) {
        gameInfo.addPlayer(name, board);
        playerKey = gameInfo.getPlayerInfo(1).key;
        playerGame[name] = { gameId: gameInfo.id, key: playerKey };

        games[gameInfo.id].state = 'ready';
      }
      else {
        // Player was already on the waiting list
        playerKey = gameInfo.getPlayerInfo(0).key;
        gamesWaiting.push(gameInfo.id);
      }
    }
    
    contentDeliver(res, { game: gameInfo.id, key: playerKey });  
  });
};


/**
 * Close game and update players state
 */
function closeGame (gameId) {
  playerGame[games[gameId].getPlayerInfo(0).name] = undefined;
  playerGame[games[gameId].getPlayerInfo(1).name] = undefined;

  games[gameId].state = 'closed';  
};


/**
 * Player left the game
 * Send notification to his opponent and close the game
 */
function playerLeft (gameId, name) {
  var looser = games[gameId].getPlayerId(name);
  var winner = 1 - looser;
  
  sseDeliver(games[gameId].getPlayerConnection(winner), { left: name });
  closeGame(gameId);
};


/**
 * Handle update - Using Server Side Events
 */
function handleUpdate (req, res, params) {

  // Initialize SSE
  sseInit(req, res);
  
  var name = params.name;
  var gameId = Number(params.game);
  var gameKey = params.key;
  
  // Verify all parameters received
  var playerInfo = playerGame[name];
  if (playerInfo === undefined || playerInfo.gameId !== gameId || playerInfo.key !== gameKey) {
    sseDeliver(res, { error: 'Invalid update request.' });
    res.end();
    return;
  }

  /*
  // If player closes the connection, end the game
  req.on('close', function () {
  playerLeft(gameId, name);
  });
  */
  
  // Save player SSE connection to the game
  games[gameId].setPlayerConnection(games[gameId].getPlayerId(name), res);

  // If both players already joined the game,
  // Notify each other about his opponent and turn
  // Update game state
  if(games[gameId].countConnections() === 2) {
    var curTurn = games[gameId].getTurn();
    
    var resFs = { opponent: games[gameId].getPlayerInfo(1).name, turn: curTurn };
    sseDeliver(games[gameId].getPlayerConnection(0), resFs);

    var resSn = { opponent: games[gameId].getPlayerInfo(0).name, turn: curTurn };
    sseDeliver(games[gameId].getPlayerConnection(1), resSn);

    games[gameId].state = 'playing';
  }
};


/**
 * Hangle notify - Receive a shot on a game
 */
function handleNotify (res, params) {

  var name = params.name;
  var gameId = Number(params.game);
  var gameKey = params.key;
  var row = params.row;
  var col = params.col;
  
  // Verify all parameters received
  var playerInfo = playerGame[name];
  if (playerInfo === undefined || playerInfo.gameId !== gameId || playerInfo.key !== gameKey) {
    contentDeliver(res, { error: 'Invalid notify request.' });
    return;
  }
  else if (!paramsValidator.coordinates(row, col)) {
    contentDeliver(res, { error: 'Invalid notify request.' });
    return; 
  }

  // Verify turn
  if (games[gameId].getTurn() !== name) {
    contentDeliver(res, { error: 'Not your turn.' });
    return;
  }
  
  var player = games[gameId].getPlayerId(name);
  
  // Check if the shot is not repeated and, if not, if it's an hit
  var shotRes = games[gameId].shot(player, row, col);
  if (shotRes === -1) {
    contentDeliver(res, { error: 'You already made a shot in this position.' });
    return;
  }

  var move = { name: name, row: row, col: col, hit: (shotRes === 1) };
  var result;

  // Check if player won the game
  if (games[gameId].checkWin(player)) {
    result = { move: move, winner: name };
    updateRanking(name, games[gameId].countPlayerShots(player));
    closeGame(gameId);
  }
  else {
    games[gameId].changeTurn();
    result = { move: move, turn: games[gameId].getTurn() };
  }

  // Send move to both players
  sseDeliver(games[gameId].getPlayerConnection(0), result);
  sseDeliver(games[gameId].getPlayerConnection(1), result);
  
  contentDeliver(res, {});
};


/**
 * Hangle leave - Player stopped waiting for an opponent
 */
function handleLeave (res, params) {

  var name = params.name;
  var gameId = Number(params.game);
  var gameKey = params.key;
  
  // Verify all parameters received
  var playerInfo = playerGame[name];
  if (playerInfo === undefined || playerInfo.gameId !== gameId || playerInfo.key !== gameKey) {
    contentDeliver(res, { error: 'Invalid leave request.' });
    return;
  }

  // Check if the game is on waiting list
  // Cannot leave if the game has already started
  if (games[gameId].state !== 'waiting') {
    contentDeliver(res, { error: 'Cannot leave the game!' });
    return;
  }
  
  // Leave the game and update games and players info
  games[gameId].state = 'aborted';
  games[gameId] = undefined;
  playerGame[name] = undefined;

  contentDeliver(res, {});
};


/**
 * Deliver server errors - Log the errors and notify user
 */
function errorDeliver (res, msg) {
  console.error(msg);
  res.writeHeader(500, {});
  res.end();
};


/**
 * Deliver server responses
 */
function contentDeliver (res, msg) {
  res.writeHeader(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(msg));
};


/**
 * Initialize Server Side Events connection
 */
function sseInit (req, res) {
  req.socket.setTimeout(Infinity);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write('\n');
};


/**
 * Deliver messages on Server Side Events connection
 */
function sseDeliver (res, msg) {
  res.write('data: ' + JSON.stringify(msg) + '\n\n');
};
