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
  node_js: ['6'],
  before_script: ['npm prune'],
  after_success: ['npm run semantic-release'],
  branches: {
    // ignore git tags created by semantic-release, like "v1.2.3"
    except: [/^v\d+\.\d+\.\d+$/.toString()]
  }
}

const travisymlMulti = _.assign({}, travisyml, {
  node_js: [
    '4',
    '6',
    '7'
  ],
  after_success: [
    'curl -Lo travis_after_all.py https://git.io/vXXtr',
    'python travis_after_all.py',
    'export $(cat .to_export_back) &> /dev/null',
    'npm run semantic-release'
  ]
})

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
  const choices = [
    'Single Node.js version.',
    'Multiple Node.js versions.',
    'Create no `.travis.yml`'
  ]
  const answers = await inquirer.prompt([{
    type: 'list',
    name: 'yml',
    message: 'What kind of `.travis.yml` do you want?',
    choices
  }])
  const ans = choices.indexOf(answers.yml)
  if (ans === 2) return
  const tyml = yaml.safeDump(ans === 0 ? travisyml : travisymlMulti)
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

  const {repo} = await promisify(travis.repos(info.ghrepo.slug[0], info.ghrepo.slug[1]).get.bind(travis))()
  travis.repoid = repo.id

  const {result} = await promisify(travis.hooks(repo.id).put.bind(travis))({
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
