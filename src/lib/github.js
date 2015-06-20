const crypto = require('crypto')

const base32 = require('base32')
const _ = require('lodash')
const inquirer = require('inquirer')
const request = require('request')
const validator = require('validator')

function ask2FA (cb) {
  inquirer.prompt([
    {
      type: 'input',
      name: 'code',
      message: 'What is your GitHub two-factor authentication code?',
      validate: validator.isNumeric
    }
  ], (answers) => {
    cb(answers.code)
  })
}

function randomId () {
  return base32.encode(crypto.randomBytes(4))
}

function createAuthorization (infoObj, cb) {
  const log = infoObj.logger
  const reponame = infoObj.ghrepo && infoObj.ghrepo.slug[1]
  const node = (reponame ? `-${reponame}-` : '-') + randomId()
  request({
    method: 'POST',
    url: `${infoObj.github.endpoint}/authorizations`,
    json: true,
    auth: infoObj.github,
    headers: {
      'User-Agent': 'semantic-release',
      'X-GitHub-OTP': infoObj.github.code
    },
    body: {
      scopes: [
        'repo',
        'read:org',
        'user:email',
        'repo_deployment',
        'repo:status',
        'write:repo_hook'
      ],
      note: `semantic-release${node}`
    }
  }, (error, response, body) => {
    if (error) return cb(error)
    const scode = response.statusCode
    if (scode === 201) {
      return cb(null, body)
    }
    if (scode === 401 && response.headers['x-github-otp']) {
      const type = response.headers['x-github-otp'].split('; ')[1]
      if (infoObj.github.retry) {
        log.warn('Invalid two-factor authentication code.')
      } else {
        log.info(`Two-factor authentication code needed via ${type}.`)
      }
      ask2FA((code) => {
        infoObj.github.code = code
        infoObj.github.retry = true
        createAuthorization(infoObj, cb)
      })
      return
    }
    cb(new Error('could not login'))
  })
}

export default function (pkg, infoObj, cb) {
  const log = infoObj.logger
  inquirer.prompt([
    {
      type: 'input',
      name: 'username',
      message: 'What is your GitHub username?',
      default: infoObj.npm.username,
      validate: _.bind(validator.isLength, validator, _, 1)
    },
    {
      type: 'password',
      name: 'password',
      message: 'What is your GitHub password?',
      validate: _.bind(validator.isLength, validator, _, 1)
    }
  ], (answers) => {
    infoObj.github = answers
    infoObj.github.endpoint = infoObj.ghepurl || 'https://api.github.com'
    createAuthorization(infoObj, (error, data) => {
      if (error) {
        log.error('Could not login to GitHub.')
        log.error('Please check your credentials.')
        return cb(error)
      }
      infoObj.github.token = data.token
      log.info('Successfully created GitHub token.')
      cb()
    })
  })
}
