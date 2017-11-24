const log = require('npmlog');

module.exports = function(service) {
  try {
    const keytar = require('keytar'); // eslint-disable-line import/no-unresolved
    const key = `semantic-release-cli:${service}`;
    return {
      get: username => keytar.getPassword(key, username),
      set: (username, password) => keytar.setPassword(key, username, password),
    };
  } catch (err) {
    return {
      get: () => {},
      set: () => log.warn('keytar is not installed correctly, not saving password'),
    };
  }
};
