
exports.generateVirtualBoard = function () {
  var newBoard = [], line = [];
  for (var i = 0; i < 12; i ++)
    line.push(false);
  for (var i = 0; i < 12; i ++)  
    newBoard.push(line);
  return newBoard;
};
