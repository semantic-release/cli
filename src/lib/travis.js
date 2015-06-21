const { readFileSync } = require('fs')
const { join } = require('path')

const async = require('async')
const _ = require('lodash')
const Travis = require('travis-ci')
const yaml = require('js-yaml')

const home = process.env[process.platform === 'win32' ? 'USERPROFILE' : 'HOME']

function _waitSync (travis, cb) {
  travis.users.get((error, res) => {
    if (res.user.is_syncing) {
      return setTimeout(_waitSync.bind(null, travis, cb), error ? 1000 : 300)
    }
    cb()
  })
}

function syncTravis (travis, cb) {
  travis.users.sync.post(() => {
    _waitSync(travis, cb)
  })
}

function setEnvVar (infoObj, name, value, cb) {
  const log = infoObj.logger
  const tagent = infoObj.travis.agent
  tagent.request(
    'GET',
    `/settings/env_vars?repository_id=${infoObj.travis.repoid}`,
    (error, res) => {
      if (error) {
        log.error('Could not get environment variables on TravisCI.')
        return cb(error)
      }
      let envid = _.result(_.find(res.env_vars, 'name', name), 'id')
      envid = envid ? `/${envid}` : ''
      tagent.request(
        envid ? 'PATCH' : 'POST',
        `/settings/env_vars${envid}?repository_id=${infoObj.travis.repoid}`, {
          env_var: {
            name,
            value,
            public: false
          }
        }, (error, res) => {
          if (error) {
            log.error('Could not set environment variable on TravisCI.')
            return cb(error)
          }
          cb()
        })
    })
}

function setUpTravis (pkg, infoObj, cb) {
  const log = infoObj.logger
  const travis = infoObj.travis
  syncTravis(travis, () => {
    travis
    .repos(infoObj.ghrepo.slug[0], infoObj.ghrepo.slug[1])
    .get((error, res) => {
      if (error) {
        log.error('Could not get repository on TravisCI.')
        return cb(error)
      }
      infoObj.travis.repoid = res.repo.id
      travis.hooks(res.repo.id).put({
        hook: {
          active: true
        }
      }, (error, res) => {
        if (error || !res.result) {
          log.error('Could not create TravisCI hook.')
          return cb(error || new Error('could not enable hook'))
        }
        log.info('Successfully created TravisCI hook.')
        async.series([
          setEnvVar.bind(null, infoObj, 'GH_TOKEN', infoObj.github.token),
          setEnvVar.bind(null, infoObj, 'NPM_TOKEN', infoObj.npm.token)
        ], (error) => {
          if (error) {
            return cb(error)
          }
          log.info('Successfully set environment variables on TravisCI.')
          cb()
        })
      })
    })
  })
}

export default function (endpoint, pkg, infoObj, cb) {
  const log = infoObj.logger
  const travisPath = join(home, '.travis/config.yml')
  let token
  try {
    let travisConfig = yaml.safeLoad(readFileSync(travisPath, 'utf8'))
    token = travisConfig.endpoints[`${endpoint}/`].access_token
  } catch (e) {
    log.warn('Could not load travis config for endpoint.')
  }
  const travis = infoObj.travis = new Travis({
    version: '2.0.0'
  })
  travis.agent._endpoint = endpoint
  if (!token) {
    travis.authenticate({
      github_token: infoObj.github.token
    }, (error) => {
      if (error) {
        log.error('Could not login to TravisCI.')
        return cb(error)
      }
      setUpTravis(pkg, infoObj, cb)
    })
    return
  }
  travis.agent.setAccessToken(token)
  setUpTravis(pkg, infoObj, cb)
}
