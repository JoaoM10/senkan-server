var validator = require('validator');
var _ = require('underscore');


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
    var vis = createVirtualBoard();
    var ships = [];

    for (var i = 1; i <= 10; i ++) {
      for (var j = 1; j <= 10; j ++) {
        if (board[i - 1][j - 1] && !vis[i][j]) {
          var size = 1;
          vis[i][j] = true;
          
          if (j < 10 && board[i - 1][j - 1 + 1]) { // placed horizontally
            while (j - 1 + size < 10 && board[i - 1][j - 1 + size]) {
              vis[i][j + size] = true;
              size ++;
            }
          }
          else { // placed vertically
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


// Create a virtual board (with margins)
function createVirtualBoard () {
  var newBoard = [], line = [];
  for (var i = 0; i < 12; i ++)
    line.push(false);
  for (var i = 0; i < 12; i ++)  
    newBoard.push(line);
  return newBoard;
}
