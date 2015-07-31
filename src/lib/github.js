const crypto = require('crypto')

const _ = require('lodash')
const base32 = require('base32')
const inquirer = require('inquirer')
const request = require('request')
const validator = require('validator')

function ask2FA (cb) {
  inquirer.prompt([{
    type: 'input',
    name: 'code',
    message: 'What is your GitHub two-factor authentication code?',
    validate: validator.isNumeric
  }], (answers) => {
    cb(answers.code)
  })
}

function randomId () {
  return base32.encode(crypto.randomBytes(4))
}

function createAuthorization (info, cb) {
  const log = info.log
  const reponame = info.ghrepo && info.ghrepo.slug[1]
  const node = (reponame ? `-${reponame}-` : '-') + randomId()

  request({
    method: 'POST',
    url: `${info.github.endpoint}/authorizations`,
    json: true,
    auth: info.github,
    headers: {
      'User-Agent': 'semantic-release',
      'X-GitHub-OTP': info.github.code
    },
    body: {
      scopes: [
        info.ghrepo && info.ghrepo.private ? 'repo' : 'public_repo'
      ],
      note: `semantic-release${node}`
    }
  }, (err, response, body) => {
    if (err) return cb(err)

    const status = response.statusCode

    if (status === 201) return cb(null, body)

    if (status === 401 && response.headers['x-github-otp']) {
      const type = response.headers['x-github-otp'].split('; ')[1]

      if (info.github.retry) {
        log.warn('Invalid two-factor authentication code.')
      } else {
        log.info(`Two-factor authentication code needed via ${type}.`)
      }

      ask2FA((code) => {
        info.github.code = code
        info.github.retry = true
        createAuthorization(info, cb)
      })

      return
    }

    cb(new Error('Could not login to GitHub.'))
  })
}

module.exports = function (pkg, info, cb) {
  const log = info.log

  inquirer.prompt([{
    type: 'input',
    name: 'username',
    message: 'What is your GitHub username?',
    default: info.npm.username,
    validate: _.bind(validator.isLength, validator, _, 1)
  }, {
    type: 'password',
    name: 'password',
    message: 'What is your GitHub password?',
    validate: _.bind(validator.isLength, validator, _, 1)
  }], (answers) => {
    info.github = answers
    info.github.endpoint = info.ghepurl || 'https://api.github.com'

    createAuthorization(info, (err, data) => {
      if (err) {
        log.error('Could not login to GitHub. Check your credentials.', err)
        return cb(err)
      }

      info.github.token = data.token
      log.info('Successfully created GitHub token.')
      cb(null)
    })
  })
}
