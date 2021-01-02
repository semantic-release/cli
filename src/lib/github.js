/* eslint require-atomic-updates: off */

const clipboard = require('clipboardy');
const _ = require('lodash');
const inquirer = require('inquirer');
const log = require('npmlog');

module.exports = async function (info) {
  if (_.has(info.options, 'gh-token')) {
    info.github = {
      endpoint: info.ghepurl || 'https://api.github.com',
      token: info.options['gh-token'],
    };
    log.info('Using GitHub token from command line argument.');
    return;
  }

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'token',
      message: 'What is your GitHub personal access token?',
      default: async () => {
        const clipboardValue = await clipboard.read();
        return clipboardValue.length === 40 ? clipboardValue : null;
      },
      validate: (input) => (input.length === 40 ? true : 'Invalid token length'),
    },
  ]);

  info.github = answers;
  const {token} = info.github;

  if (!token) throw new Error('User could not supply GitHub Personal Access Token.');

  info.github.token = token;
  log.info('Successfully created GitHub token.');
};
