const {readFileSync, writeFileSync} = require('fs')

const _ = require('lodash')
const {promisify} = require('bluebird')
const nopt = require('nopt')
const npm = require('npm')
const request = require('request-promise').defaults({json: true})

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

module.exports = async function (argv) {
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

  if (info.options.argv.remain[0] !== 'setup' && info.options.argv.remain[0] !== 'init' || info.options.help) {
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
  --npm-token=<String> NPM auth token

Aliases:
  init                 setup`)
    process.exit(0)
  }

  try {
    var config = (await promisify(npm.load.bind(npm))({progress: false})).config
  } catch (e) {
    console.log('Failed to load npm config.', e)
    process.exit(1)
  }

  info.loglevel = config.get('loglevel') || 'warn'
  const log = info.log = getLog(info.loglevel)

  try {
    await require('./lib/repository')(pkg, info)
    await require('./lib/npm')(pkg, info)
    await require('./lib/github')(pkg, info)
    await require('./lib/ci')(pkg, info)
  } catch (err) {
    log.error(err)
    process.exit(1)
  }

  pkg.version = '0.0.0-development'

  pkg.scripts = pkg.scripts || {}
  pkg.scripts['semantic-release'] = 'semantic-release pre && npm publish && semantic-release post'

  pkg.repository = pkg.repository || {
    type: 'git',
    url: info.giturl
  }

  if (info.ghrepo.private && !pkg.publishConfig) {
    pkg.publishConfig = {access: 'restricted'}
  }

  try {
    const {'dist-tags': distTags} = await request('https://registry.npmjs.org/semantic-release')
    pkg.devDependencies = pkg.devDependencies || {}
    pkg.devDependencies['semantic-release'] = `^${distTags[info.options.tag]}`
  } catch (e) {
    log.error('Could not get latest `semantic-release` version.', e)
  }

  log.verbose('Writing `package.json`.')
  writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`)
  log.info('Done.')
}
