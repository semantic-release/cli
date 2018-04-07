const {readFileSync, writeFileSync} = require('fs');
const _ = require('lodash');
const pify = require('pify');
const nopt = require('nopt');
const npm = require('npm');
const request = require('request-promise').defaults({json: true});
const ownPkg = require('../package.json');
const getLog = require('./lib/log');

const pkg = JSON.parse(readFileSync('./package.json'));

require('update-notifier')({
  pkg: _.defaults(ownPkg, {version: '0.0.0'}),
}).notify();

const knownOptions = {
  tag: String,
  version: Boolean,
  help: Boolean,
  keychain: Boolean,
  'ask-for-passwords': Boolean,
  'gh-token': String,
  'npm-token': String,
  'gh-username': String,
  'npm-username': String,
};

const shortHands = {
  v: ['--version'],
  h: ['--help'],
};

module.exports = async function(argv) {
  const info = {
    options: _.defaults(nopt(knownOptions, shortHands, argv, 2), {
      keychain: true,
      tag: 'latest',
    }),
  };

  if (info.options.version) {
    console.log(ownPkg.version || 'development');
    return;
  }

  if ((info.options.argv.remain[0] !== 'setup' && info.options.argv.remain[0] !== 'init') || info.options.help) {
    console.log(`
semantic-release-cli (v${ownPkg.version})

Usage:
  semantic-release-cli setup [--tag=<String>]

Options:
  -h --help            Show this screen.
  -v --version         Show version.
  --[no-]keychain      Use keychain to get passwords [default: true].
  --ask-for-passwords  Ask for the passwords even if passwords are stored [default: false].
  --tag=<String>       npm tag to install [default: 'latest'].
  --gh-token=<String>  GitHub auth token
  --npm-token=<String> npm auth token
  --gh-username=<String>  GitHub username
  --npm-username=<String>  npm username

Aliases:
  init                 setup`);
    return;
  }

  let config;
  try {
    config = (await pify(npm.load)({progress: false})).config;
  } catch (err) {
    console.log('Failed to load npm config.', err);
    process.exitCode = 1;
    return;
  }

  info.loglevel = config.get('loglevel') || 'warn';
  const log = getLog(info.loglevel);
  info.log = log;

  try {
    await require('./lib/repository')(pkg, info);
    await require('./lib/npm')(pkg, info);
    await require('./lib/github')(pkg, info);
    await require('./lib/ci')(pkg, info);
  } catch (err) {
    log.error(err);
    process.exitCode = 1;
  }

  pkg.version = '0.0.0-development';

  pkg.scripts = pkg.scripts || {};
  pkg.scripts['semantic-release'] = 'semantic-release';

  pkg.repository = pkg.repository || {type: 'git', url: info.giturl};

  if (info.ghrepo.private && !pkg.publishConfig) {
    pkg.publishConfig = {access: 'restricted'};
  }

  try {
    const {'dist-tags': distTags} = await request('https://registry.npmjs.org/semantic-release');
    pkg.devDependencies = pkg.devDependencies || {};
    pkg.devDependencies['semantic-release'] = `^${distTags[info.options.tag]}`;
  } catch (err) {
    log.error('Could not get latest `semantic-release` version.', err);
  }

  log.verbose('Writing `package.json`.');
  writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
  log.info('Done.');
};
