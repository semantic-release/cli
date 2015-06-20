const _ = require('lodash')
const npmconf = require('npmconf')
const RegClient = require('npm-registry-client')
const inquirer = require('inquirer')
const validator = require('validator')

function getNpmToken (pkg, infoObj, cb) {
  const log = infoObj.logger
  const client = new RegClient({ log: log })
  client.adduser(infoObj.npm.registry, {
    auth: infoObj.npm
  }, (error, data) => {
    if (error) {
      log.error('Could not login to npm registry.')
      log.error('Please check your credentials.')
      return cb(error)
    }
    infoObj.npm.token = data.token
    log.info('Successfully created npm token.')
    cb()
  })
}

export default function (pkg, infoObj, cb) {
  const log = infoObj.logger
  npmconf.load((error, conf) => {
    if (error) {
      log.error('Could not load npm config.')
      return cb(error)
    }
    inquirer.prompt([
      {
        type: 'input',
        name: 'registry',
        message: 'What is your npm registry?',
        default: conf.get('registry'),
        validate: _.bind(validator.isURL, null, _, {
          protocols: [ 'http', 'https' ],
          require_protocol: true
        })
      },
      {
        type: 'input',
        name: 'username',
        message: 'What is your npm username?',
        default: conf.get('username'),
        validate: _.bind(validator.isLength, null, _, 1)
      },
      {
        type: 'input',
        name: 'email',
        message: 'What is your npm email?',
        default: conf.get('email'),
        validate: validator.isEmail
      },
      {
        type: 'password',
        name: 'password',
        message: 'What is your npm password?',
        validate: _.bind(validator.isLength, null, _, 1)
      }
    ], (answers) => {
      infoObj.npm = answers
      conf.set('username', answers.username, 'user')
      conf.set('email', answers.email, 'user')
      conf.save('user', (error) => {
        if (error) {
          log.warn('Could not save npm config.')
          log.silly(error)
        }
        getNpmToken(pkg, infoObj, cb)
      })
    })
  })
}
