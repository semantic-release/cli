const _ = require('lodash');
const inquirer = require('inquirer');
const validator = require('validator');
const travis = require('./travis');
const circle = require('./circle');

const cis = {
  'Travis CI': travis.bind(null, 'https://api.travis-ci.org'),
  'Travis CI Pro': travis.bind(null, 'https://api.travis-ci.com'),
  'Travis CI Enterprise': travis,
  'Circle CI': circle,
  'Other (prints tokens)': (pkg, info) => {
    const message = `
${_.repeat('-', 46)}
GH_TOKEN=${info.github.token}
NPM_TOKEN=${info.npm.token}
${_.repeat('-', 46)}
`;
    console.log(message);
  },
};

module.exports = async function(pkg, info) {
  const choices = _.keys(cis);

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'ci',
      message: 'What CI are you using?',
      choices,
      default: info.ghrepo && info.ghrepo.private ? 1 : 0,
    },
    {
      type: 'input',
      name: 'endpoint',
      message: 'What is your Travis CI enterprise url?',
      validate: _.bind(validator.isURL, null, _, {protocols: ['http', 'https'], require_protocol: true}), // eslint-disable-line camelcase
      when: answers => answers.ci === choices[2],
    },
  ]);

  await cis[answers.ci].apply(null, _.compact([answers.endpoint, pkg, info]));
};
