const { readFileSync, writeFileSync } = require('fs')

const async = require('async')
const nopt = require('nopt')
const npmconf = require('npmconf')
const request = require('request')
const Logger = require('./logger')

const repository = require('./lib/repository')
const npm = require('./lib/npm')
const github = require('./lib/github')
const ci = require('./lib/ci')

const knownOpts = {
  next: Boolean
}

const shortHands = {
  n: [ 'next' ]
}

export default function (argv) {
  let infoObj = {}
  infoObj.parsedArgs = nopt(knownOpts, shortHands, argv, 2)
  npmconf.load((error, conf) => {
    infoObj.loglevel = conf.get('loglevel')
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
    async.applyEachSeries([
      repository,
      npm,
      github,
      ci
    ], pkg, infoObj, (error) => {
      if (error) return log.silly(error)
      delete pkg.version
      pkg.scripts['semantic-release'] = 'semantic-release-scripts pre && npm publish && semantic-release-scripts post'
      request({
        url: 'https://registry.npmjs.org/semantic-release-scripts',
        json: true
      }, (err, res, body) => {
        if (err) {
          log.error('Could not get latest `semantic-release-scripts` version.')
          log.silly(err)
        } else {
          pkg.devDependencies['semantic-release-scripts'] = `^${body['dist-tags'].latest}`
        }
        log.verbose('Writing `package.json`.')
        writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`)
        log.info('Done.')
      })
    })
  })
}
