var validator = require('validator');

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
