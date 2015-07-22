const _ = require('lodash')
const inquirer = require('inquirer')
const npmconf = require('npmconf')
const RegClient = require('npm-registry-client')
const validator = require('validator')

function getNpmToken (pkg, info, cb) {
  const log = info.log
  const client = new RegClient({ log: log })
  client.adduser(info.npm.registry, {
    auth: info.npm
  }, (err, data) => {
    if (err) {
      log.error('Could not login to npm registry. Check your credentials.', err)
      return cb(err)
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
      log.error('Could not load npm config.', err)
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
      validate: _.bind(validator.isLength, null, _, 1)
    }, {
      type: 'input',
      name: 'email',
      message: 'What is your npm email?',
      default: conf.get('email'),
      validate: validator.isEmail
    }, {
      type: 'password',
      name: 'password',
      message: 'What is your npm password?',
      validate: _.bind(validator.isLength, null, _, 1)
    }], (answers) => {
      info.npm = answers

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
