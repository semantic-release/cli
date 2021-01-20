/* eslint require-atomic-updates: off */

const inquirer = require('inquirer');
const request = require('request-promise').defaults({resolveWithFullResponse: true});
const validator = require('validator');
const log = require('npmlog');
const sodium = require('tweetsodium');

async function ask2FA() {
  return (
    await inquirer.prompt([
      {
        type: 'input',
        name: 'code',
        message: 'What is your GitHub two-factor authentication code?',
        validate: validator.isNumeric,
      },
    ])
  ).code;
}

function createEncryptedSecret(value, key) {
  const messageBytes = Buffer.from(value);
  const keyBytes = Buffer.from(key, 'base64');

  const encryptedBytes = sodium.seal(messageBytes, keyBytes);

  return Buffer.from(encryptedBytes).toString('base64');
}

async function createSecret(info) {
  const owner = info.ghrepo.slug[0];
  const repo = info.ghrepo.slug[1];
  try {
    const response = await request({
      method: 'GET',
      url: `${info.github.endpoint}/repos/${owner}/${repo}/actions/secrets/public-key`,
      auth: {
        bearer: info.github.token,
      },
      headers: {'User-Agent': 'semantic-release', 'X-GitHub-OTP': info.github.code},
    });
    if (response.statusCode === 200) {
      const {key, key_id: keyId} = JSON.parse(response.body);

      const encryptedValue = createEncryptedSecret(info.npm.token, key);

      const responsePut = await request({
        method: 'PUT',
        url: `${info.github.endpoint}/repos/${owner}/${repo}/actions/secrets/NPM_TOKEN`,
        auth: {
          bearer: info.github.token,
        },
        headers: {'User-Agent': 'semantic-release', 'X-GitHub-OTP': info.github.code},
        json: true,
        body: {
          encrypted_value: encryptedValue, // eslint-disable-line camelcase
          key_id: keyId, // eslint-disable-line camelcase
        },
      });

      if (responsePut.statusCode !== 201 && responsePut.statusCode !== 204) {
        throw new Error(
          `Can’t add the NPM_TOKEN secret to Github Actions. Please add it manually: NPM_TOKEN=${info.npm.token}`
        );
      }
    }
  } catch (error) {
    if (error.statusCode === 401 && error.response.headers['x-github-otp']) {
      const [, type] = error.response.headers['x-github-otp'].split('; ');

      if (info.github.retry) log.warn('Invalid two-factor authentication code.');
      else log.info(`Two-factor authentication code needed via ${type}.`);

      const code = await ask2FA();
      info.github.code = code;
      info.github.retry = true;
      return createSecret(info);
    }

    throw error;
  }
}

module.exports = async function (pkg, info) {
  await createSecret(info);

  log.info('Successfully created GitHub Actions NPM_TOKEN secret.');
};
