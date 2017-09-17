const url = require('url')

const _ = require('lodash')
const {promisify} = require('bluebird')
const inquirer = require('inquirer')
const npm = require('npm')
const RegClient = require('npm-registry-client')
const validator = require('validator')
const log = require('npmlog')

const passwordStorage = require('./password-storage')('npm')

async function getNpmToken ({npm, options}) {
  const client = new RegClient({log})

  const body = {
    _id: `org.couchdb.user:${npm.username}`,
    name: npm.username,
    password: npm.password,
    type: 'user',
    roles: [],
    date: new Date().toISOString()
  }

  const uri = url.resolve(npm.registry, '-/user/org.couchdb.user:' + encodeURIComponent(npm.username))
  const {token} = await promisify(client.request.bind(client, uri))({method: 'PUT', body})

  if (!token) throw new Error('Could not login to GitHub.')

  if (options.keychain) {
    passwordStorage.set(npm.username, npm.password)
  }
  npm.token = token
  log.info('Successfully created npm token.')
}

module.exports = async function (pkg, info) {
  info.npm = await inquirer.prompt([{
    type: 'input',
    name: 'registry',
    message: 'What is your npm registry?',
    default: npm.config.get('registry'),
    validate: _.bind(validator.isURL, null, _, {
      protocols: [ 'http', 'https' ],
      require_protocol: true
    })
  }, {
    type: 'input',
    name: 'username',
    message: 'What is your npm username?',
    default: info.options['npm-username'] || npm.config.get('username'),
    validate: _.ary(_.bind(validator.isLength, null, _, 1), 1),
    when: () => !_.has(info.options, 'npm-token')
  }, {
    type: 'password',
    name: 'password',
    message: 'What is your npm password?',
    validate: _.ary(_.bind(validator.isLength, null, _, 1), 1),
    when: answers => {
      if (_.has(info.options, 'npm-token')) return false
      return !info.options.keychain || info.options['ask-for-passwords'] || !passwordStorage.get(answers.username)
    }
  }])

  if (_.has(info.options, 'npm-token')) {
    info.npm.token = info.options['npm-token']
    log.info('Using NPM token from command line argument.')
    return
  }

  info.npm.password = info.npm.password || passwordStorage.get(info.npm.username)

  await getNpmToken(info)
}
