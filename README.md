# semantic-release-cli
| [![Build Status](https://travis-ci.org/semantic-release/cli.svg?branch=master)](https://travis-ci.org/semantic-release/cli) | [![Coverage Status](https://coveralls.io/repos/semantic-release/cli/badge.svg?branch=master&service=github)](https://coveralls.io/github/semantic-release/cli?branch=master) | [![Dependency Status](https://david-dm.org/semantic-release/cli/master.svg)](https://david-dm.org/semantic-release/cli/master) | [![devDependency Status](https://david-dm.org/semantic-release/cli/master/dev-status.svg)](https://david-dm.org/semantic-release/cli/master#info=devDependencies) | [![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://github.com/feross/standard) |
| --- | --- | --- | --- | --- |

[![NPM](https://nodei.co/npm/semantic-release-cli.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/semantic-release-cli/)
[![NPM](https://nodei.co/npm/semantic-release.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/semantic-release/)

## Install

```bash
npm install -g semantic-release-cli

cd your-module
semantic-release-cli setup
```

![dialogue](https://cloud.githubusercontent.com/assets/908178/8766357/f3eadaca-2e34-11e5-8ebb-d40b9ae613d7.png)

## Options

	Usage:
	  semantic-release-cli setup [options]

	Options:
	  -h --help           Show this screen.
	  -v --version        Show version.
	  --[no-]keychain     Use keychain to get passwords [default: true].
	  --ask-for-passwords Ask for the passwords even if passwords are stored [default: false].
	  --tag=<String>      npm tag to install [default: 'latest'].
    --gh-token=<String>  GitHub auth token
    --npm-token=<String> npm auth
    --gh-username=<String>  GitHub username
    --npm-username=<String>  npm username

	Aliases:
	  init                 setup

## What it Does
__semantic-release-cli performs the following steps:__

1. Asks for the information it needs. You will need to provide it with:
	* Whether your GitHub repository is public or private
	* Which NPM registry you want to use (Default: https://registry.npmjs.org/)
	* Your NPM username (unless passwords were previously saved to keychain)
	* Your NPM email
	* Your NPM password
	* Your GitHub username
	* Your GitHub password (unless passwords were previously saved to keychain)
	* Which continuous integration system you want to use. (Options: Travis CI / Pro / Enterprise, or Other)
	* Whether you want to test a single node.js version (e.g. - 0.12) or multiple node.js versions (e.g. - 0.10, 0.12, etc.)
1. Save your passwords to your local OS's keychain using [keytar](https://www.npmjs.com/package/keytar) for future use (unless `--no-keychain` was specified)
1. NPM Add User
	* Runs `npm adduser` with the npm information provided to generate a `.npmrc`
	* Parses the NPM token from the `.npmrc` for future use
1. Create GitHub Personal Token
	* Logs into GitHub using the username and password provided
	* Creates a [GitHub Personal Access Token](https://github.com/settings/tokens) and saves it for future use
1. Overwrite your .travis.yml file (if Travis CI was selected)
	* `before_install: npm i -g npm@^2.0.0`: install NPM 2
	* `before_script: curl -Lo travis_after_all.py https://git.io/vLSON`: install [travis-after-all](https://github.com/travis-ci/travis-ci/issues/929) script to enable running `semantic-release` after ALL build succeed
	* `after_success: python travis_after_all.py` and `npm run semantic-release`: run `semantic-release` exactly once after all builds pass
	* Set other sane defaults: `sudo: false`, `cache: directories: node_modules`, `notifications: email: false`, `before_script: npm prune`
1. Update your package.json
	* Remove `version` field (you don't need it anymore -- `semantic-release` will set the version for you automatically)
	* Add a `semantic-release` script: `"semantic-release": "semantic-release pre && npm publish && semantic-release post"`
	* Add `semantic-release` as a `devDependency`
	* Add or overwrite the [`repository` field](https://docs.npmjs.com/files/package.json#repository)
1. Login to Travis CI to configure the package
	* Enable builds of your repo
	* Add GH_TOKEN and NPM_TOKEN environment variables in the settings

## Other CI Servers

By default, `semantic-release-cli` supports the popular Travis CI server. If you select `Other` as your server during configuration, `semantic-release-cli` will print out the environment variables you need to set on your CI server. You will be responsible for adding these environment variables as well as configuring your CI server to run `npm run semantic-release` after all the builds pass.

Note that your CI server will also need to set the environment variable `CI=true` so that `semantic-release` will not perform a dry run. (Most CI services do this by default.) See the `semantic-release` documentation for more details.

## License

MIT License
2015 © Christoph Witzko and [contributors](https://github.com/semantic-release/cli/graphs/contributors)

![https://twitter.com/trodrigues/status/509301317467373571](https://cloud.githubusercontent.com/assets/908178/6091690/cc86f58c-aeb8-11e4-94cb-15f15f486cde.png)
