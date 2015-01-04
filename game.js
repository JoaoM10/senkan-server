var crypto = require('crypto');


var gameCnt = 1;


module.exports = function () {
  return {
    id: gameCnt ++,
    players: [],
    addPlayer: function (name, board) {
      this.players.push({ name: name, board: board, key: crypto.randomBytes(32).toString('hex') });
    },
    getPlayerInfo: function (pos) {
      return this.players[pos];
    }
  };
};
