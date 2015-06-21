const { readFileSync, writeFileSync } = require('fs')

const async = require('async')
const nopt = require('nopt')

const Logger = require('./logger')

const repository = require('./lib/repository')
const npm = require('./lib/npm')
const github = require('./lib/github')
const ci = require('./lib/ci')

const knownOpts = {
  debug: Boolean
}

const shortHands = {
  d: [ 'debug' ]
}

export default function (argv) {
  let infoObj = {}
  infoObj.parsedArgs = nopt(knownOpts, shortHands, argv, 2)
  // TODO: get log level from cli args
  infoObj.loglevel = 'silly'
  const log = infoObj.logger = new Logger(infoObj.loglevel)
  log.verbose('Reading `package.json`.')
  let pkg
  try {
    pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  } catch (e) {
    log.error('Could not read/parse `package.json`.')
    log.error('Please run `npm init`.')
    log.silly(e)
    return
  }
  async.applyEachSeries([ repository, npm, github, ci ], pkg, infoObj, (error) => {
    if (error) return log.silly(error)
    delete pkg.version
    pkg.scripts['semantic-release'] = 'semantic-release-core pre && npm publish && semantic-release-core post'
    log.verbose('Writing `package.json`.')
    writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`)
    log.info('Done.')
  })
}
