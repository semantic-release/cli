const pkg = require('../../package.json')
const keytar = require('keytar')

module.exports = function (service) {
  var key = pkg.name + ':' + service

  return {
    get: function (username) {
      return keytar.getPassword(key, username)
    },
    set: function (username, password) {
      keytar.replacePassword(key, username, password)
    }
  }
}
