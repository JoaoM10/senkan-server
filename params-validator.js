var validator = require('validator');
var _ = require('underscore');
var vboard = require('./vboard');

// Validate credentials
exports.credentials = function (name, password) {

  if (name === undefined || name.length === 0)
    return 'Parameter name absent.';
  if (!validator.isLength(name, 1, 25) || !validator.matches(name, '^[a-zA-Z0-9_]+$'))
    return 'Parameter name should have at most 25 alphanumeric characters or \'_\'.';

  if (password === undefined || password.length === 0)
    return 'Parameter pass absent.';
  if (!validator.isLength(password, 1, 25))
    return 'Parameter pass should have at most 25 characters.';
  
  return undefined;
};


// Validate board
exports.board = function (board) {

  var check = (board.length === 10);
  
  for (var i = 0; i < 10; i ++) {
    check = check && (board[i].length === 10);
    for (var j = 0; j < 10; j ++)
      check = check && (board[i][j] === true || board[i][j] === false);
  }
  
  if (check) {
    // Make sure that ships are well placed
    var vis = vboard.generateVirtualBoard();
    var ships = [];

    for (var i = 1; i <= 10; i ++) {
      for (var j = 1; j <= 10; j ++) {
        if (board[i - 1][j - 1] && !vis[i][j]) {
          var size = 1;
          vis[i][j] = true;

          // check orientation
          if (j < 10 && board[i - 1][j - 1 + 1]) {
            // horizontally
            while (j - 1 + size < 10 && board[i - 1][j - 1 + size]) {
              vis[i][j + size] = true;
              size ++;
            }
          }
          else {
            // vertically
            while (i - 1 + size < 10 && board[i - 1 + size][j - 1]) {
              vis[i + size][j] = true;
              size ++;
            }
          }
          
          ships.push(size);
        }
      }
    }

    ships.sort();

    check = (_.difference(ships, [2, 3, 3, 4, 5]).length === 0);
  }

  if (!check)
    return 'Invalid board.';
  
  return undefined;
};


// Validate board coordinates
exports.coordinates = function (row, col) {

  if (!isInt(row) || !isInt(col))
    return false;
  
  row = Number(row);
  col = Number(col);
  
  if (row < 1 || row > 10 || col < 1 || col > 10)
    return false;    
  
  return true;
};


// Check if value is an integer
function isInt (value) {
  return (!isNaN(value) && (function (x) {
    return ((x | 0) === x);
  })(parseFloat(value)));
};
