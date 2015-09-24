const { readFileSync, writeFileSync } = require('fs')

const _ = require('lodash')
const async = require('async')
const nopt = require('nopt')
const npmconf = require('npmconf')
const request = require('request')

const getLog = require('./lib/log')

const ownPkg = require('../package.json')
let pkg = JSON.parse(readFileSync('./package.json'))

require('update-notifier')({
  pkg: _.defaults(
    ownPkg,
    {version: '0.0.0'}
  )
}).notify()

const knownOptions = {
  tag: String,
  version: Boolean,
  help: Boolean,
  keychain: Boolean,
  'ask-for-passwords': Boolean,
  'gh-token': String,
  'npm-token': String
}

const shortHands = {
  v: ['--version'],
  h: ['--help']
}

module.exports = function (argv) {
  let info = {
    options: _.defaults(
      nopt(knownOptions, shortHands, argv, 2),
      {
        keychain: true,
        tag: 'latest'
      }
    )
  }

  if (info.options.version) {
    console.log(ownPkg.version || 'development')
    process.exit(0)
  }

  if (info.options.argv.remain[0] !== 'setup' || info.options.help) {
    console.log(`
semantic-release-cli

Usage:
  semantic-release-cli setup [--tag=<String>]

Options:
  -h --help            Show this screen.
  -v --version         Show version.
  --[no-]keychain      Use keychain to get passwords [default: true].
  --ask-for-passwords  Ask for the passwords even if passwords are stored [default: false].
  --tag=<String>       npm tag to install [default: 'latest'].
  --gh-token=<String>  Github auth token
  --npm-token=<String> NPM auth token`)
    process.exit(0)
  }

  npmconf.load((err, conf) => {
    if (err) {
      log.error('Failed to load npm config.', err)
      process.exit(1)
    }

    info.loglevel = conf.get('loglevel') || 'warn'
    const log = info.log = getLog(info.loglevel)

    async.applyEachSeries([
      require('./lib/repository'),
      require('./lib/npm'),
      require('./lib/github'),
      require('./lib/ci')
    ], pkg, info, (err) => {
      if (err) {
        log.error(err)
        process.exit(1)
      }

      delete pkg.version

      pkg.scripts = pkg.scripts || {}
      pkg.scripts['semantic-release'] = 'semantic-release pre && npm publish && semantic-release post'

      pkg.repository = pkg.repository || {
        type: 'git',
        url: info.giturl
      }

      request({
        url: 'https://registry.npmjs.org/semantic-release',
        json: true
      }, (err, res, body) => {
        if (err) {
          log.error('Could not get latest `semantic-release` version.', err)
        } else {
          pkg.devDependencies = pkg.devDependencies || {}
          pkg.devDependencies['semantic-release'] = `^${body['dist-tags'][info.options.tag]}`
        }

        log.verbose('Writing `package.json`.')
        writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`)
        log.info('Done.')
      })
    })
  })
}
