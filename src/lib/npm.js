const url = require('url');
const _ = require('lodash');
const pify = require('pify');
const inquirer = require('inquirer');
const npm = require('npm');
const RegClient = require('npm-registry-client');
const validator = require('validator');
const log = require('npmlog');
const passwordStorage = require('./password-storage')('npm');

const client = new RegClient({log});
const DEFAULT_REGISTRY = 'https://registry.npmjs.org/';

async function getNpmToken({npm, options}) {
  const body = {
    _id: `org.couchdb.user:${npm.username}`,
    name: npm.username,
    password: npm.password,
    type: 'user',
    roles: [],
    date: new Date().toISOString(),
  };

  const uri = url.resolve(npm.registry, '-/user/org.couchdb.user:' + encodeURIComponent(npm.username));
  let token;

  try {
    [{token}] = await pify(client.request.bind(client), {multiArgs: true})(uri, {
      method: 'PUT',
      body,
    });
  } catch (err) {
    const [error, , , response] = err;

    if (error.code === 'E401' && response.headers['www-authenticate'] === 'OTP') {
      await askForOTP(uri, body, npm);
      ({token} = npm);
    } else if (error.code === 'E409') {
      // Some registries (Sinopia) return 409 for existing users, retry using authenticated call
      try {
        ({token} = await pify(client.request.bind(client))(uri, {
          authed: true,
          method: 'PUT',
          auth: {username: npm.username, password: npm.password},
          body,
        }));
      } catch (err) {
        log.verbose(`Error: ${err}`);
      }
    } else {
      log.verbose(`Error: ${error}`);
    }
  }

  if (!token) throw new Error(`Could not login to npm.`);

  if (options.keychain) {
    passwordStorage.set(npm.username, npm.password);
  }
  npm.token = token;
  log.info(`Successfully created npm token. ${npm.token}`);
}

async function askForOTP(uri, body, npm) {
  return inquirer.prompt({
    type: 'input',
    name: 'otp',
    message: 'What is your NPM two-factor authentication code?',
    validate: answer => validateToken(answer, uri, body, npm),
  });
}

async function validateToken(otp, uri, body, npm) {
  if (!validator.isNumeric(otp)) {
    return false;
  }

  try {
    const response = await pify(client.request.bind(client))(uri, {method: 'PUT', auth: {otp}, body});
    if (response && response.ok) {
      npm.token = response.token;
      return true;
    }
  } catch (err) {
    // Invalid 2FA token
  }
  return 'Invalid authentication code';
}

function getRegistry(pkg, conf) {
  if (pkg.publishConfig && pkg.publishConfig.registry) return pkg.publishConfig.registry;

  if (pkg.name[0] !== '@') return conf.get('registry') || DEFAULT_REGISTRY;

  const scope = pkg.name.split('/')[0];
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
      when: async answers => {
        if (_.has(info.options, 'npm-token')) return false;
        try {
          const storedPassword = await passwordStorage.get(answers.username);
          return !info.options.keychain || info.options['ask-for-passwords'] || !storedPassword;
        } catch (err) {
          log.error('Something went wrong with your stored credentials. Delete them from your keychain and try again');
        }
      },
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

  if (_.has(info.options, 'npm-token')) {
    info.npm.token = info.options['npm-token'];
    log.info('Using npm token from command line argument.');
    return;
  }

  const storedPassword = await passwordStorage.get(info.npm.username);

  info.npm.password = info.npm.password || storedPassword;
  info.npm.authmethod = info.npm.authmethod || 'token';

  if (info.npm.authmethod === 'token') {
    await getNpmToken(info);
  }
};
