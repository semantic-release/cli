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
    if (!repo) return callback(new Error('No repository found.'))
    pkg.repository = { type: 'git', url: `${ghUrl(repo)}.git` }
  }
  if (/^git\+/.test(pkg.repository.url)) {
    pkg.repository.url = pkg.repository.url.substr(4)
    pkg.repository.url = pkg.repository.url.replace(/^(ssh:\/\/git|git:\/\/)@/, 'https://')
  }
  callback(null, pkg.repository.url)
}

module.exports = function (pkg, info, cb) {
  const log = info.log

  getRemoteUrl(pkg, (err, rurl) => {
    if (err) {
      log.error('Could not get repository url. Please create/add the repository.')
      return cb(err)
    }

    log.verbose(`Detected git url: ${rurl}`)
    info.giturl = rurl
    const parsedUrl = parseGhUrl(rurl)

    if (!parsedUrl) {
      log.info('Not a reqular GitHub URL.')
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
      }, {
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
          info.ghepurl = answers.url
        }

        cb(null)
      })

      return
    }

    info.ghrepo = {slug: parsedUrl}

    inquirer.prompt([{
      type: 'confirm',
      name: 'private',
      message: 'Is the GitHub repository private?',
      default: false
    }], (answers) => {
      _.assign(info.ghrepo, answers)
      if (answers.private) {
        return cb(null)
      }

      request.head(rurl, (err, res) => {
        if (err || res.statusCode === 404) {
          log.error('Could not find repository on GitHub. Please create and add the repository.')
          return cb(err || new Error('GitHub repository not found.'))
        }

        cb(null)
      })
    })
  })
}
