const _ = require('lodash')
const inquirer = require('inquirer')
const npmconf = require('npmconf')
const RegClient = require('npm-registry-client')
const validator = require('validator')

const passwordStorage = require('./password-storage')('npm')

function getNpmToken (pkg, info, cb) {
  const log = info.log
  const client = new RegClient({ log: log })
  client.adduser(info.npm.registry, {
    auth: info.npm
  }, (err, data) => {
    if (err) {
      log.error('Could not login to npm registry. Check your credentials.')
      return cb(err)
    }

    if (info.options.keychain) {
      passwordStorage.set(info.npm.username, info.npm.password)
    }
    info.npm.token = data.token
    log.info('Successfully created npm token.')
    cb(null)
  })
}

module.exports = function (pkg, info, cb) {
  const log = info.log

  npmconf.load((err, conf) => {
    if (err) {
      log.error('Could not load npm config.')
      return cb(err)
    }

    inquirer.prompt([{
      type: 'input',
      name: 'registry',
      message: 'What is your npm registry?',
      default: conf.get('registry'),
      validate: _.bind(validator.isURL, null, _, {
        protocols: [ 'http', 'https' ],
        require_protocol: true
      })
    }, {
      type: 'input',
      name: 'username',
      message: 'What is your npm username?',
      default: conf.get('username'),
      validate: _.ary(_.bind(validator.isLength, null, _, 1), 1),
      when: function (answers) {
        return !_.has(info.options, 'npm-token')
      }
    }, {
      type: 'input',
      name: 'email',
      message: 'What is your npm email?',
      default: conf.get('email'),
      validate: validator.isEmail,
      when: function (answers) {
        return !_.has(info.options, 'npm-token')
      }
    }, {
      type: 'password',
      name: 'password',
      message: 'What is your npm password?',
      validate: _.ary(_.bind(validator.isLength, null, _, 1), 1),
      when: function (answers) {
        if (_.has(info.options, 'npm-token')) return false
        if (!info.options.keychain) return true
        if (info.options['ask-for-passwords']) return true
        return !passwordStorage.get(answers.username)
      }
    }], (answers) => {
      info.npm = answers

      if (_.has(info.options, 'npm-token')) {
        info.npm.token = info.options['npm-token']
        log.info('Using NPM token from command line argument.')
        return cb(null)
      }

      answers.password = answers.password || passwordStorage.get(answers.username)
      conf.set('username', answers.username, 'user')
      conf.set('email', answers.email, 'user')

      conf.save('user', (err) => {
        if (err) {
          log.warn('Could not save npm config.')
          log.verbose(err)
        }

        getNpmToken(pkg, info, cb)
      })
    })
  })
}
