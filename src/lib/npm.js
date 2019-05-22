const _ = require('lodash');
const inquirer = require('inquirer');
const npm = require('npm');
const profile = require('npm-profile');
const validator = require('validator');
const log = require('npmlog');

const DEFAULT_REGISTRY = 'https://registry.npmjs.org/';

async function getNpmToken({npm}) {
  let token;

  try {
    const result = await profile.loginCouch(npm.username, npm.password, {registry: npm.registry});
    token = result.token;
  } catch (error) {
    if (error.code === 'EOTP') {
      await askForOTP(npm);
      token = npm.token;
    }
  }

  if (!token) throw new Error(`Could not login to npm.`);

  npm.token = token;
  log.info(`Successfully created npm token. ${npm.token}`);
}

function askForOTP(npm) {
  return inquirer.prompt({
    type: 'input',
    name: 'otp',
    message: 'What is your NPM two-factor authentication code?',
    validate: answer => validateToken(answer, npm),
  });
}

async function validateToken(otp, npm) {
  if (!validator.isNumeric(otp)) {
    return false;
  }

  try {
    const {token} = await profile.loginCouch(npm.username, npm.password, {registry: npm.registry, otp});

    npm.token = token;

    return true;
  } catch (error) {
    // Invalid 2FA token
  }

  return 'Invalid authentication code';
}

function getRegistry(pkg, conf) {
  if (pkg.publishConfig && pkg.publishConfig.registry) return pkg.publishConfig.registry;

  if (pkg.name[0] !== '@') return conf.get('registry') || DEFAULT_REGISTRY;

  const [scope] = pkg.name.split('/');
  const scopedRegistry = conf.get(`${scope}/registry`);

  if (scopedRegistry) return scopedRegistry;

  return conf.get('registry') || DEFAULT_REGISTRY;
}

module.exports = async function(pkg, info) {
  info.npm = await inquirer.prompt([
    {
      type: 'input',
      name: 'registry',
      message: 'What is your npm registry?',
      default: getRegistry(pkg, npm.config),
      validate: _.bind(validator.isURL, null, _, {
        protocols: ['http', 'https'],
        require_protocol: true, // eslint-disable-line camelcase
        require_tld: false, // eslint-disable-line camelcase
      }),
    },
    {
      type: 'list',
      name: 'authmethod',
      message: 'Which authentication method is this npm registry using?',
      choices: [{name: 'Token based', value: 'token'}, {name: 'Legacy (username, password, email)', value: 'legacy'}],
      default: 'token',
      when: answers => answers.registry !== DEFAULT_REGISTRY && !_.has(info.options, 'npm-token'),
    },
    {
      type: 'input',
      name: 'username',
      message: 'What is your npm username?',
      default: info.options['npm-username'] || npm.config.get('username'),
      validate: _.ary(_.bind(validator.isLength, null, _, 1), 1),
      when: () => !_.has(info.options, 'npm-token'),
    },
    {
      type: 'password',
      name: 'password',
      message: 'What is your npm password?',
      validate: _.ary(_.bind(validator.isLength, null, _, 1), 1),
      when: () => !_.has(info.options, 'npm-token'),
    },
    {
      type: 'input',
      name: 'email',
      message: 'What is your npm email address?',
      default: info.options['npm-username'] || npm.config.get('init-author-email'),
      validate: _.ary(_.bind(validator.isLength, null, _, 1), 1),
      when: answers => answers.authmethod === 'legacy',
    },
  ]);

  info.npm.authmethod = info.npm.authmethod || 'token';

  if (_.has(info.options, 'npm-token')) {
    info.npm.token = info.options['npm-token'];
    log.info('Using npm token from command line argument.');
    return;
  }

  if (info.npm.authmethod === 'token') {
    await getNpmToken(info);
  }
};
