var crypto = require('crypto');
var vboard = require('./vboard');


var gameCnt = 1;


module.exports = function () {
  return {
    id: gameCnt ++,
    players: [],
    turn: getRandomInt(0, 1),
    addPlayer: function (name, board) {
      this.players.push({ name: name,
                          board: board,
                          key: crypto.randomBytes(32).toString('hex'),
                          shots: vboard.generateVirtualBoard(),
                          helth: 17,
                          connection: undefined
                        });
    },
    getPlayerInfo: function (pos) {
      return this.players[pos];
    },
    getTurn: function () {
      return this.players[this.turn].name;
    },
    getPlayerConnection: function (pos) {
      return this.players[pos].connection;
    },
    setPlayerConnection: function (pos, conn) {
      this.players[pos].connection = conn;
    },
  };
};

function getRandomInt (low, high) {
  return Math.floor(Math.random() * (high - low + 1) + low);
};
