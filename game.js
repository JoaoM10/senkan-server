var crypto = require('crypto');
var vboard = require('./vboard');


var gameCnt = 1;


module.exports = function () {
  return {
    id: gameCnt ++,
    players: [],
    turn: getRandomInt(0, 1),
    state: 'waiting',
    connectionsCounter: 0,
    addPlayer: function (name, board) {
      this.players.push({ name: name,
                          board: board,
                          key: crypto.randomBytes(32).toString('hex'),
                          shotsBoard: vboard.generateVirtualBoard(),
                          health: 17,
                          shotsCount: 0,
                          connection: undefined
                        });
    },
    getPlayerInfo: function (pl) {
      return this.players[pl];
    },
    getPlayerId: function (name) {
      if (this.players[0].name === name)
        return 0;
      return 1;
    },
    getTurn: function () {
      return this.players[this.turn].name;
    },
    getPlayerConnection: function (pl) {
      return this.players[pl].connection;
    },
    setPlayerConnection: function (pl, conn) {
      this.players[pl].connection = conn;
      this.connectionsCounter ++;
    },
    countConnections: function () {
      return this.connectionsCounter;
    },
    changeTurn: function () {
      this.turn = 1 - this.turn;
    },
    countPlayerShots: function (pl) {
      return this.players[pl].shotsCount;
    },
    shot: function (pl, row, col) {
      
      // Verify that is not repeating a shot
      if (this.players[pl].shotsBoard[row][col])
        return -1;

      // Mark this shot
      this.players[pl].shotsBoard[row][col] = true;
      this.players[pl].shotsCount ++;

      // Check if is an hit
      if (this.players[1 - pl].board[row - 1][col - 1]) {
        this.players[1 - pl].health --;
        return 1;
      }
      
      return 0;
    },
    checkWin: function (pl) {
      return (this.players[1 - pl].health === 0);
    }
  };
};

function getRandomInt (low, high) {
  return Math.floor(Math.random() * (high - low + 1) + low);
};
