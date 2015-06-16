const log = require('npmlog')

export default function (level) {
  log.level = level || 'silly'
  this.silly = log.log.bind(log.log, 'silly', 'semantic-release')
  this.verbose = log.log.bind(log.log, 'verbose', 'semantic-release')
  this.info = log.log.bind(log.log, 'info', 'semantic-release')
  this.http = log.log.bind(log.log, 'http', 'semantic-release')
  this.warn = log.log.bind(log.log, 'warn', 'semantic-release')
  this.error = log.log.bind(log.log, 'error', 'semantic-release')
}
