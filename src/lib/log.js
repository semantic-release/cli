const log = require('npmlog');

module.exports = function(level) {
  log.level = level;
  ['silly', 'verbose', 'info', 'http', 'warn', 'error'].forEach(level => {
    log[level] = log[level].bind(log, 'semantic-release');
  });

  return log;
};
