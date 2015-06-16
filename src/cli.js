const { readFileSync } = require('fs')

const async = require('async')
const nopt = require('nopt')

const Logger = require('./logger')

const repository = require('./lib/repository')
const npm = require('./lib/npm')
const github = require('./lib/github')
const travis = require('./lib/travis')

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
    return
  }
  async.applyEachSeries([ repository, npm, github, travis ], pkg, infoObj, (error) => {
    if (error) return log.silly(error)
    log.info('Done.')
  })
}
