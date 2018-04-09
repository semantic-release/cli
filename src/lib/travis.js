const {readFileSync, writeFileSync, accessSync} = require('fs');
const {join} = require('path');

const _ = require('lodash');
const pify = require('pify');
const pRetry = require('p-retry');
const home = require('user-home');
const inquirer = require('inquirer');
const Travis = require('travis-ci');
const yaml = require('js-yaml');
const log = require('npmlog');
const request = require('request-promise').defaults({json: true});

const travisyml = {
  language: 'node_js',
  cache: {
    // https://twitter.com/maybekatz/status/905213355748720640
    directories: ['~/.npm'],
  },
  notifications: {
    email: false,
  },
  // https://github.com/nodejs/Release#release-schedule
  node_js: ['9', '8', '6', '4'], // eslint-disable-line camelcase
  after_success: ['npm run travis-deploy-once "npm run semantic-release"'], // eslint-disable-line camelcase
  branches: {
    // ignore git tags created by semantic-release, like "v1.2.3"
    except: [/^v\d+\.\d+\.\d+$/.toString()],
  },
};

async function isSyncing(travis) {
  const res = await pify(travis.users.get.bind(travis))();
  return _.get(res, 'user.is_syncing');
}

async function syncTravis(travis) {
  try {
    await pify(travis.users.sync.post.bind(travis))();
  } catch (err) {
    if (err.message !== 'Sync already in progress. Try again later.') throw err;
  }

  await pRetry(() => isSyncing(travis), {forever: true, minTimeout: 500, maxTimeout: 1000});
}

async function setEnvVar(travis, name, value) {
  const request = pify(travis.agent.request.bind(travis.agent));

  const response = await request('GET', `/settings/env_vars?repository_id=${travis.repoid}`);
  let envid = _.get(_.find(response.env_vars, ['name', name]), 'id');
  envid = envid ? `/${envid}` : '';

  await request(
    envid ? 'PATCH' : 'POST',
    `/settings/env_vars${envid}?repository_id=${travis.repoid}`,
    {env_var: {name, value, public: false}} // eslint-disable-line camelcase
  );
}

async function createTravisYml() {
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'yml',
      message: 'Do you want a `.travis.yml` file with semantic-release setup?',
      default: true,
    },
  ]);
  if (!answers.yml) return;
  const tyml = yaml.safeDump(travisyml);
  try {
    accessSync('.travis.yml');
    const {ok} = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'ok',
        default: false,
        message: 'Do you want to overwrite the existing `.travis.yml`?',
      },
    ]);
    if (!ok) return;
  } catch (err) {}
  log.verbose('Writing `.travis.yml`.');
  writeFileSync('.travis.yml', tyml);
  log.info('Successfully created `.travis.yml`.');
}

async function setUpTravis(pkg, info) {
  const travis = info.travis;

  log.info('Syncing repositories...');
  await syncTravis(travis);

  travis.repoid = _.get(
    await pify(travis.repos(info.ghrepo.slug[0], info.ghrepo.slug[1]).get.bind(travis))(),
    'repo.id'
  );

  if (!travis.repoid) throw new Error('Could not get repo id');

  const {result} = await pify(travis.hooks(travis.repoid).put.bind(travis))({
    hook: {active: true},
  });
  if (!result) throw new Error('Could not enable hook on Travis CI');
  log.info('Successfully created Travis CI hook.');

  await setEnvVar(travis, 'GH_TOKEN', info.github.token);

  if (info.npm.authmethod === 'token') {
    await setEnvVar(travis, 'NPM_TOKEN', info.npm.token);
  } else {
    await setEnvVar(travis, 'NPM_USERNAME', info.npm.username);
    await setEnvVar(travis, 'NPM_PASSWORD', info.npm.password);
    await setEnvVar(travis, 'NPM_EMAIL', info.npm.email);
  }

  log.info('Successfully set environment variables on Travis CI.');
  await createTravisYml(info);

  pkg.scripts['travis-deploy-once'] = 'travis-deploy-once';

  try {
    const {'dist-tags': distTags} = await request('https://registry.npmjs.org/travis-deploy-once');
    pkg.devDependencies = pkg.devDependencies || {};
    pkg.devDependencies['travis-deploy-once'] = `^${distTags[info.options.tag]}`;
  } catch (err) {
    log.error('Could not get latest `travis-deploy-once` version.', err);
  }

  log.verbose('Writing `package.json`.');
  writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
}

module.exports = async function(endpoint, pkg, info) {
  const travisPath = join(home, '.travis/config.yml');
  let token;

  try {
    const travisConfig = yaml.safeLoad(readFileSync(travisPath, 'utf8'));
    token = travisConfig.endpoints[`${endpoint}/`].access_token;
  } catch (err) {
    log.info('Could not load Travis CI config for endpoint.');
  }

  const travis = new Travis({
    version: '2.0.0',
    headers: {
      // Won't work with a different user-agent ¯\_(ツ)_/¯
      'User-Agent': 'Travis',
    },
  });
  info.travis = travis;
  travis.agent._endpoint = endpoint;

  if (token) {
    travis.agent.setAccessToken(token);
  } else {
    await pify(travis.authenticate.bind(travis))({github_token: info.github.token}); // eslint-disable-line camelcase
  }

  await setUpTravis(pkg, info);
};
