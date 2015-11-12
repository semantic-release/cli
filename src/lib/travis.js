const { readFileSync, writeFileSync } = require('fs')
const { join } = require('path')

const _ = require('lodash')
const async = require('async')
const home = require('user-home')
const inquirer = require('inquirer')
const Travis = require('travis-ci')
const yaml = require('js-yaml')

const travisyml = {
  sudo: false,
  language: 'node_js',
  cache: {
    directories: ['node_modules']
  },
  notifications: {
    email: false
  },
  node_js: ['5'],
  before_install: ['npm i -g npm@^2.0.0'],
  before_script: ['npm prune'],
  after_success: ['npm run semantic-release'],
  branches: {
    // ignore git tags created by semantic-release, like "v1.2.3"
    except: [/^v\d+\.\d+\.\d+$/.toString()]
  }
}

const travisyml_multi = _.assign({}, travisyml, {
  node_js: [
    '5',
    '4',
    'iojs-v3',
    'iojs-v2',
    'iojs-v1',
    '0.12',
    '0.10'
  ],
  before_script: [
    'npm prune'
  ],
  after_success: [
    'curl -Lo travis_after_all.py https://git.io/travis_after_all',
    'python travis_after_all.py',
    'export $(cat .to_export_back) &> /dev/null',
    'npm run semantic-release'
  ]
})

function _waitSync (travis, cb) {
  travis.users.get((error, res) => {
    if (res.user.is_syncing) {
      return setTimeout(_waitSync.bind(null, travis, cb), error ? 1000 : 300)
    }

    cb(null)
  })
}

function syncTravis (travis, cb) {
  travis.users.sync.post(() => {
    _waitSync(travis, cb)
  })
}

function setEnvVar (info, name, value, cb) {
  const log = info.log
  const tagent = info.travis.agent
  tagent.request(
    'GET',
    `/settings/env_vars?repository_id=${info.travis.repoid}`,
    (err, res) => {
      if (err) {
        log.error('Could not get environment variables on Travis CI.')
        return cb(err)
      }

      let envid = _.result(_.find(res.env_vars, 'name', name), 'id')
      envid = envid ? `/${envid}` : ''

      tagent.request(
        envid ? 'PATCH' : 'POST',
        `/settings/env_vars${envid}?repository_id=${info.travis.repoid}`, {
          env_var: {
            name,
            value,
            public: false
          }
        }, (err, res) => {
          if (err) {
            log.error('Could not set environment variable on Travis CI.')
            return cb(err)
          }

          cb(null)
        })
    })
}

function createTravisYml (info, cb) {
  const log = info.log
  const choices = [
    'Single Node.js version.',
    'Multiple Node.js versions.',
    'Create no `.travis.yml`'
  ]
  inquirer.prompt([{
    type: 'list',
    name: 'yml',
    message: 'What kind of `.travis.yml` do you want?',
    choices
  }], (answers) => {
    const ans = choices.indexOf(answers.yml)
    if (ans === 2) return cb()
    const tyml = yaml.safeDump(ans === 0 ? travisyml : travisyml_multi)
    log.verbose('Writing `.travis.yml`.')
    writeFileSync('.travis.yml', tyml)
    log.info('Successfully created `.travis.yml`.')

    cb(null)
  })
}

function setUpTravis (pkg, info, cb) {
  const log = info.log
  const travis = info.travis
  syncTravis(travis, () => {
    travis
    .repos(info.ghrepo.slug[0], info.ghrepo.slug[1])
    .get((err, res) => {
      if (err) {
        log.error('Could not get repository on Travis CI.')
        return cb(err)
      }

      info.travis.repoid = res.repo.id
      travis.hooks(res.repo.id).put({
        hook: {active: true}
      }, (err, res) => {
        if (err || !res.result) {
          log.error('Could not create Travis CI hook.')
          return cb(err || new Error('Could not enable hook on Travis CI'))
        }

        log.info('Successfully created Travis CI hook.')

        async.series([
          setEnvVar.bind(null, info, 'GH_TOKEN', info.github.token),
          setEnvVar.bind(null, info, 'NPM_TOKEN', info.npm.token)
        ], (err) => {
          if (err) {
            return cb(err)
          }

          log.info('Successfully set environment variables on Travis CI.')
          createTravisYml(info, cb)
        })
      })
    })
  })
}

module.exports = function (endpoint, pkg, info, cb) {
  const log = info.log
  const travisPath = join(home, '.travis/config.yml')
  let token
  try {
    let travisConfig = yaml.safeLoad(readFileSync(travisPath, 'utf8'))
    token = travisConfig.endpoints[`${endpoint}/`].access_token
  } catch (e) {
    log.info('Could not load Travis CI config for endpoint.')
  }

  const travis = info.travis = new Travis({
    version: '2.0.0'
  })
  travis.agent._endpoint = endpoint

  if (!token) {
    travis.authenticate({
      github_token: info.github.token
    }, (err) => {
      if (err) {
        log.error('Could not login to Travis CI.')
        return cb(err)
      }

      setUpTravis(pkg, info, cb)
    })

    return
  }

  travis.agent.setAccessToken(token)
  setUpTravis(pkg, info, cb)
}
