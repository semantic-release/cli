const _ = require('lodash')
const inquirer = require('inquirer')
const validator = require('validator')

const travis = require('./travis')

const cis = {
  'TravisCI': travis.bind(null, 'https://api.travis-ci.org'),
  'TravisCI Pro': travis.bind(null, 'https://api.travis-ci.com'),
  'TravisCI Enterprise': travis,
  'Other (print token)': (pkg, infoObj, cb) => {
    const log = infoObj.logger
    log.info(_.repeat('-', 46))
    log.info(`GH_TOKEN=${infoObj.github.token}`)
    log.info(`NPM_TOKEN=${infoObj.npm.token}`)
    log.info(_.repeat('-', 46))
    cb()
  }
}

export default function (pkg, infoObj, cb) {
  const choices = Object.keys(cis)
  inquirer.prompt([
    {
      type: 'list',
      name: 'ci',
      message: 'What CI are you using?',
      choices,
      default: infoObj.ghrepo && infoObj.ghrepo.private ? 1 : 0
    },
    {
      type: 'input',
      name: 'endpoint',
      message: 'What is your TravisCI enterprise url?',
      validate: _.bind(validator.isURL, null, _, {
        protocols: [ 'http', 'https' ],
        require_protocol: true
      }),
      when: (ans) => ans.ci === choices[2]
    }
  ], (answers) => {
    if (answers.endpoint) {
      return cis[answers.ci](answers.endpoint, pkg, infoObj, cb)
    }
    cis[answers.ci](pkg, infoObj, cb)
  })
}
