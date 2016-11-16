const log = require('npmlog')

module.exports = function (service) {
  try {
    var keytar = require('keytar')
  } catch (e) {
    return {
      get: () => {},
      set: () => log.warn('keytar is not installed correctly, not saving password')
    }
  }

  const key = `semantic-release-cli:${service}`
  return {
    get: username => keytar.getPassword(key, username),
    set: (username, password) => keytar.replacePassword(key, username, password)
  }
}
