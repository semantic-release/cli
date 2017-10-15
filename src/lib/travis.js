const {readFileSync, writeFileSync, accessSync} = require('fs')
const {join} = require('path')

const _ = require('lodash')
const {promisify, delay} = require('bluebird')
const home = require('user-home')
const inquirer = require('inquirer')
const Travis = require('travis-ci')
const yaml = require('js-yaml')
const log = require('npmlog')

const travisyml = {
  language: 'node_js',
  cache: {
    directories: ['node_modules']
  },
  notifications: {
    email: false
  },
  node_js: ['8', '6'],
  before_script: ['npm prune'],
  after_success: ['npm run semantic-release'],
  branches: {
    // ignore git tags created by semantic-release, like "v1.2.3"
    except: [/^v\d+\.\d+\.\d+$/.toString()]
  }
}

async function isSyncing (travis) {
  try {
    var res = await promisify(travis.users.get.bind(travis))()
    return _.get(res, 'user.is_syncing')
  } catch (e) {}
}

async function syncTravis (travis) {
  try {
    await promisify(travis.users.sync.post.bind(travis))()
  } catch (e) {
    if (e.message !== 'Sync already in progress. Try again later.') throw e
  }

  while (await isSyncing(travis)) {
    await delay(1000)
  }
}

async function setEnvVar (travis, name, value) {
  const tagent = travis.agent
  const response = await promisify(tagent.request.bind(tagent))('GET', `/settings/env_vars?repository_id=${travis.repoid}`)
  let envid = _.get(_.find(response.env_vars, ['name', name]), 'id')
  envid = envid ? `/${envid}` : ''

  await await promisify(tagent.request.bind(tagent))(
    envid ? 'PATCH' : 'POST',
    `/settings/env_vars${envid}?repository_id=${travis.repoid}`,
    {env_var: {name, value, public: false}}
  )
}

async function createTravisYml (info) {
  const answers = await inquirer.prompt([{
    type: 'confirm',
    name: 'yml',
    message: 'Do you want a `.travis.yml` file with semantic-release setup?',
    default: true
  }])
  if (!answers.yml) return
  const tyml = yaml.safeDump(travisyml)
  try {
    accessSync('.travis.yml')
    const {ok} = await inquirer.prompt([{
      type: 'confirm',
      name: 'ok',
      default: false,
      message: 'Do you want to overwrite the existing `.travis.yml`?'
    }])
    if (!ok) return
  } catch (e) {}
  log.verbose('Writing `.travis.yml`.')
  writeFileSync('.travis.yml', tyml)
  log.info('Successfully created `.travis.yml`.')
}

async function setUpTravis (pkg, info) {
  const travis = info.travis

  log.info('Syncing repositories...')
  await syncTravis(travis)

  travis.repoid = _.get(await promisify(travis.repos(info.ghrepo.slug[0], info.ghrepo.slug[1]).get.bind(travis))(), 'repo.id')

  if (!travis.repoid) throw new Error('Could not get repo id')

  const {result} = await promisify(travis.hooks(travis.repoid).put.bind(travis))({
    hook: {active: true}
  })
  if (!result) throw new Error('Could not enable hook on Travis CI')
  log.info('Successfully created Travis CI hook.')

  await setEnvVar(travis, 'GH_TOKEN', info.github.token)
  await setEnvVar(travis, 'NPM_TOKEN', info.npm.token)
  log.info('Successfully set environment variables on Travis CI.')
  await createTravisYml(info)
}

module.exports = async function (endpoint, pkg, info) {
  const travisPath = join(home, '.travis/config.yml')

  try {
    const travisConfig = yaml.safeLoad(readFileSync(travisPath, 'utf8'))
    var token = travisConfig.endpoints[`${endpoint}/`].access_token
  } catch (e) {
    log.info('Could not load Travis CI config for endpoint.')
  }

  const travis = info.travis = new Travis({
    version: '2.0.0',
    headers: {
      // Won't work with a different user-agent ¯\_(ツ)_/¯
      'User-Agent': 'Travis'
    }
  })
  travis.agent._endpoint = endpoint

  if (token) travis.agent.setAccessToken(token)
  else await promisify(travis.authenticate.bind(travis))({github_token: info.github.token})

  await setUpTravis(pkg, info)
}
