# semantic-release-cli
| [![Build Status](https://travis-ci.org/semantic-release/cli.svg?branch=master)](https://travis-ci.org/semantic-release/cli) | [![Coverage Status](https://coveralls.io/repos/semantic-release/cli/badge.svg?branch=master&service=github)](https://coveralls.io/github/semantic-release/cli?branch=master) | [![Dependency Status](https://david-dm.org/semantic-release/cli/master.svg)](https://david-dm.org/semantic-release/cli/master) | [![devDependency Status](https://david-dm.org/semantic-release/cli/master/dev-status.svg)](https://david-dm.org/semantic-release/cli/master#info=devDependencies) | [![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://github.com/feross/standard) |
| --- | --- | --- | --- | --- |

[![NPM](https://nodei.co/npm/semantic-release-cli.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/semantic-release-cli/)
[![NPM](https://nodei.co/npm/semantic-release.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/semantic-release/)

## Automated [`semantic-release`](https://github.com/semantic-release/semantic-release-cli) setup

```bash
npm install -g semantic-release-cli

cd you-module
semantic-release-cli setup
```

![dialogue](https://cloud.githubusercontent.com/assets/908178/8766357/f3eadaca-2e34-11e5-8ebb-d40b9ae613d7.png)

## Manual Setup

This is what you would have to if `semantic-release-cli` wouldn't exist:

### `package.json`

Delete the `version` field from your `package.json`. _Really_. It's safe to do, because machines will take care of it from now on.

Install `semantic-release` and save it as a `devDependency`.

```bash
# stable channel
npm install --save-dev semantic-release

# master channel
npm install --save-dev semantic-release@master
```

Create a `semantic-release` script in the [`scripts` field](https://docs.npmjs.com/files/package.json#scripts) of your `package.json`.

```json
{
  "scripts": {
    "semantic-release": "semantic-release pre && npm publish && semantic-release post"
  }
}
```

Add a [`repository` field](https://docs.npmjs.com/files/package.json#repository) to the `package.json`.
You should do this anyway, but – as `semantic-release` depends on it – now you have to.

### CI Server

The idea is that your CI Server runs `npm run semantic-release` whenever a test run on your main branch succeeds. By default these conditions are verified assuming a [Travis CI](https://travis-ci.org/) environment. This isn't tied to a specific service though. Using the [`verifyConditions` plugin](#verifyconditions) you can easily configure your own CI Server.

The CI environment has to export `CI=true` in order for `semantic-release` to not automatically perform a dry run. Most CI services do this by default.

You need to export access tokens to the environment, so `semantic-release` can authenticate itself with GitHub and npm.  [Get a token for GitHub on their website](https://github.com/settings/tokens/new), grant it the repo/public_repo scope, and export it as `GH_TOKEN`. The smoothest and securest way to do this on Travis CI is to use [their web interface](http://docs.travis-ci.com/user/environment-variables/#Defining-Variables-in-Repository-Settings).

Unfortunately there is no web interface for obtaining npm tokens yet, so you have to run `npm adduser` locally. Copy the token from your `~/.npmrc` file afterwards. Export it as `NPM_TOKEN`.

## License

MIT License
2015 © Christoph Witzko and [contributors](https://github.com/boennemann/semantic-release/graphs/contributors)

![https://twitter.com/trodrigues/status/509301317467373571](https://cloud.githubusercontent.com/assets/908178/6091690/cc86f58c-aeb8-11e4-94cb-15f15f486cde.png)
