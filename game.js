var crypto = require('crypto');


var gameCnt = 1;


module.exports = function (res, board) {
  return {
    id: gameCnt ++,
    key: crypto.randomBytes(32).toString('hex')
  };
};

