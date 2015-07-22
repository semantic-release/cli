const _ = require('lodash')
const inquirer = require('inquirer')
const validator = require('validator')

const travis = require('./travis')

const cis = {
  'Travis CI': travis.bind(null, 'https://api.travis-ci.org'),
  'Travis CI Pro': travis.bind(null, 'https://api.travis-ci.com'),
  'Travis CI Enterprise': travis,
  'Other (prints tokens)': (pkg, info, cb) => {
    const message = `
${_.repeat('-', 46)}
GH_TOKEN=${info.github.token}
NPM_TOKEN=${info.npm.token}
${_.repeat('-', 46)}
`
    console.log(message)
    cb(null)
  }
}

module.exports = function (pkg, info, cb) {
  const choices = Object.keys(cis)

  inquirer.prompt([{
    type: 'list',
    name: 'ci',
    message: 'What CI are you using?',
    choices,
    default: info.ghrepo && info.ghrepo.private ? 1 : 0
  }, {
    type: 'input',
    name: 'endpoint',
    message: 'What is your Travis CI enterprise url?',
    validate: _.bind(validator.isURL, null, _, {
      protocols: [ 'http', 'https' ],
      require_protocol: true
    }),
    when: (ans) => ans.ci === choices[2]
  }], (answers) => {
    if (answers.endpoint) {
      return cis[answers.ci](answers.endpoint, pkg, info, cb)
    }

    cis[answers.ci](pkg, info, cb)
  })
}
