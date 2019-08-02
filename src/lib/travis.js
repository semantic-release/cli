const {readFileSync} = require('fs');
const {join} = require('path');

const _ = require('lodash');
const pify = require('pify');
const pRetry = require('p-retry');
const home = require('user-home');
const Travis = require('travis-ci');
const yaml = require('js-yaml');
const log = require('npmlog');

async function isSyncing(travis) {
  const res = await pify(travis.users.get.bind(travis))();
  return _.get(res, 'user.is_syncing');
}

async function syncTravis(travis) {
  try {
    await pify(travis.users.sync.post.bind(travis))();
  } catch (error) {
    if (error.message !== 'Sync already in progress. Try again later.') throw error;
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

async function setUpTravis(pkg, info) {
  const {travis} = info;

  log.info('Syncing repositories...');
  await syncTravis(travis);

  const [githubOrg, repoName] = info.ghrepo.slug;

  try {
    travis.repoid = _.get(await pify(travis.repos(githubOrg, repoName).get.bind(travis))(), 'repo.id');
  } catch (error) {
    if (error.file && error.file === 'not found') {
      throw new Error(`Unable to find repo id for "${info.giturl}" on Travis.`);
    } else {
      throw error;
    }
  }

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
}

module.exports = async function(endpoint, pkg, info) {
  const travisPath = join(home, '.travis/config.yml');
  let token;

  try {
    const travisConfig = yaml.safeLoad(readFileSync(travisPath, 'utf8'));
    token = travisConfig.endpoints[`${endpoint}/`].access_token;
  } catch (error) {
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
  info.endpoint = endpoint;

  travis.agent._endpoint = endpoint;

  if (token) {
    travis.agent.setAccessToken(token);
  } else {
    await pify(travis.authenticate.bind(travis))({github_token: info.github.token}); // eslint-disable-line camelcase
  }

  await setUpTravis(pkg, info);

  console.log(
    'Please refer to https://github.com/semantic-release/semantic-release/blob/master/docs/03-recipes/travis.md to configure your .travis.yml file.'
  );
};
