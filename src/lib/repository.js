const { readFileSync } = require('fs')
const url = require('url')

const _ = require('lodash')
const ghUrl = require('github-url-from-git')
const ini = require('ini')
const inquirer = require('inquirer')
const parseGhUrl = require('parse-github-repo-url')
const request = require('request')
const validator = require('validator')

function getRemoteUrl (pkg, callback) {
  if (!pkg.repository || !pkg.repository.url) {
    let gitConfig, repo
    try {
      gitConfig = ini.decode(readFileSync('./.git/config', 'utf8'))
      repo = gitConfig['remote "origin"'].url
    } catch (e) {
      return callback(e)
    }
    if (!repo) return callback(new Error('no repository found'))
    pkg.repository = { type: 'git', url: `${ghUrl(repo)}.git` }
  }
  if (/^git\+/.test(pkg.repository.url)) {
    pkg.repository.url = pkg.repository.url.substr(4)
  }
  callback(null, pkg.repository.url)
}

export default function (pkg, infoObj, cb) {
  const log = infoObj.logger
  getRemoteUrl(pkg, (error, rurl) => {
    if (error) {
      log.error('Could not get repository url.')
      log.error('Please create/add the repository.')
      return cb(error)
    }
    log.info(`Detected git url: ${rurl}`)
    infoObj.giturl = rurl
    const parsedUrl = parseGhUrl(rurl)
    if (!parsedUrl) {
      log.info('Url is not a reqular GitHub url.')
      let eurl = url.parse(rurl)
      delete eurl.pathname
      delete eurl.search
      delete eurl.query
      delete eurl.hash
      inquirer.prompt([{
        type: 'confirm',
        name: 'enterprise',
        message: 'Are you using GitHub Enterprise?',
        default: true
      },
      {
        type: 'input',
        name: 'url',
        message: 'What is your GitHub Enterprise url?',
        default: url.format(eurl),
        when: _.bind(_.get, null, _, 'enterprise'),
        validate: _.bind(validator.isURL, null, _, {
          protocols: [ 'http', 'https' ],
          require_protocol: true
        })
      }], (answers) => {
        if (answers.enterprise) {
          infoObj.ghepurl = answers.url
        }
        cb()
      })
      return
    }
    infoObj.ghrepo = { slug: parsedUrl }
    inquirer.prompt([{
      type: 'confirm',
      name: 'private',
      message: 'Is the GitHub repository private?',
      default: false
    }], (answers) => {
      _.assign(infoObj.ghrepo, answers)
      if (answers.private) {
        return cb()
      }
      request.head(rurl, (error, res) => {
        if (error || res.statusCode === 404) {
          log.error('Could not find repository on GitHub.')
          log.error('Please create and add the repository.')
          return cb(error || new Error('repository not found'))
        }
        cb()
      })
    })
  })
}
