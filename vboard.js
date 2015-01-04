
/**
 * Generate a virtual board
 * With margins on all sides
 */
exports.generateVirtualBoard = function () {
  var newBoard = [];
  for (var i = 0; i < 12; i ++) {
    var line = [];
    for (var j = 0; j < 12; j ++)  
      line.push(false);
    newBoard.push(line);
  }
  return newBoard;
};
