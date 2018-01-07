const url = require('url');

const _ = require('lodash');
const {promisifyAll} = require('bluebird');
const inquirer = require('inquirer');
const npm = require('npm');
const RegClient = require('npm-registry-client');
const validator = require('validator');
const log = require('npmlog');

const passwordStorage = require('./password-storage')('npm');

async function getNpmToken({npm, options}) {
  const client = promisifyAll(new RegClient({log}));

  const body = {
    _id: `org.couchdb.user:${npm.username}`,
    name: npm.username,
    password: npm.password,
    type: 'user',
    roles: [],
    date: new Date().toISOString(),
  };

  const uri = url.resolve(npm.registry, '-/user/org.couchdb.user:' + encodeURIComponent(npm.username));
  const { err, token } = await client.requestAsync(uri, {method: 'PUT', body } ).catch(
    err => { 
      // Some registries (Sinopia) return 409 for existing users, retry using authenticated call
      if (err.code = 'E409') {
        return client.requestAsync(uri, { authed: true, method: 'PUT', auth: { username: npm.username, password: npm.password }, body })
          .catch(err => ({ err }))
      }
    }
  )

  if (!token) throw new Error('Could not login to npm.');

  if (options.keychain) {
    passwordStorage.set(npm.username, npm.password);
  }
  npm.token = token;
  log.info('Successfully created npm token.');
}

module.exports = async function(pkg, info) {
  info.npm = await inquirer.prompt([
    {
      type: 'input',
      name: 'registry',
      message: 'What is your npm registry?',
      default: npm.config.get('registry'),
      validate: _.bind(validator.isURL, null, _, {protocols: ['http', 'https'], require_protocol: true, require_tld: false}), // eslint-disable-line camelcase
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
  ]);

  if (_.has(info.options, 'npm-token')) {
    info.npm.token = info.options['npm-token'];
    log.info('Using npm token from command line argument.');
    return;
  }

  const storedPassword = await passwordStorage.get(info.npm.username);

  info.npm.password = info.npm.password || storedPassword;

  await getNpmToken(info);
};
