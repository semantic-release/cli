const {readFileSync} = require('fs');
const url = require('url');
const _ = require('lodash');
const ghUrl = require('github-url-from-git');
const ini = require('ini');
const inquirer = require('inquirer');
const parseGhUrl = require('parse-github-repo-url');
const request = require('request-promise').defaults({resolveWithFullResponse: true});
const validator = require('validator');
const log = require('npmlog');

/* eslint-disable node/no-deprecated-api */

function getRemoteUrl({repository}) {
  if (!repository || !repository.url) {
    const gitConfig = ini.decode(readFileSync('./.git/config', 'utf8'));
    const repo = gitConfig['remote "origin"'].url;
    if (!repo) throw new Error('No repository found.');
    repository = {type: 'git', url: `${ghUrl(repo)}.git`};
  }

  const parsed = url.parse(repository.url);
  parsed.auth = null;
  parsed.protocol = 'https';
  repository.url = url.format(parsed);

  return repository.url;
}

module.exports = async function(pkg, info) {
  let repoUrl;
  try {
    repoUrl = await getRemoteUrl(pkg);
  } catch (error) {
    log.error('Could not get repository url. Please create/add the repository.');
    throw error;
  }

  log.verbose(`Detected git url: ${repoUrl}`);
  info.giturl = repoUrl;
  const parsedUrl = parseGhUrl(repoUrl);

  if (!parsedUrl) {
    log.info('Not a reqular GitHub URL.');
    const eurl = url.parse(repoUrl);
    delete eurl.pathname;
    delete eurl.search;
    delete eurl.query;
    delete eurl.hash;

    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'enterprise',
        message: 'Are you using GitHub Enterprise?',
        default: true,
      },
      {
        type: 'input',
        name: 'url',
        message: 'What is your GitHub Enterprise url?',
        default: url.format(eurl),
        when: _.bind(_.get, null, _, 'enterprise'),
        validate: _.bind(validator.isURL, null, _, {protocols: ['http', 'https'], require_protocol: true}), // eslint-disable-line camelcase
      },
    ]);
    info.ghepurl = answers.url;
    if (answers.enterprise) return;
    throw new Error(`GitHub repository URL is invalid: ${repoUrl}`);
  }

  info.ghrepo = {slug: parsedUrl};

  try {
    await request.head(repoUrl);
  } catch (error) {
    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'private',
        message: 'Is the GitHub repository private?',
        default: false,
      },
    ]);
    _.assign(info.ghrepo, answers);
    if (answers.private) return;
    throw new Error('Could not access GitHub repository');
  }
};

/* eslint-enable node/no-deprecated-api */
