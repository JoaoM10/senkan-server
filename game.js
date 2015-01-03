var crypto = require('crypto');


var gameCnt = 1;


module.exports = function () {
  return {
    id: gameCnt ++,
    key: crypto.randomBytes(32).toString('hex'),
    players: [],
    addPlayer: function (name, board) {
      this.players.push({ name: name, board: board });
    },
    getFirstPlayer: function () {
      return { name: this.players[0] };
    }
  };
};
