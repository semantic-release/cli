# semantic-release-cli

[![Travis](https://img.shields.io/travis/semantic-release/cli.svg)](https://travis-ci.org/semantic-release/cli)
[![Greenkeeper badge](https://badges.greenkeeper.io/semantic-release/cli.svg)](https://greenkeeper.io/)

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
    --npm-token=<String> npm auth token
    --circle-token=<String> CircleCI auth token
    --gh-username=<String>  GitHub username
    --npm-username=<String>  npm username

	Aliases:
	  init                 setup

## What it Does
__semantic-release-cli performs the following steps:__

1. Asks for the information it needs. You will need to provide it with:
	* Whether your GitHub repository is public or private
	* Which npm registry you want to use (Default: https://registry.npmjs.org/)
	* Your npm username (unless passwords were previously saved to keychain)
	* Your npm email
	* Your npm password
	* Your GitHub username
	* Your GitHub password (unless passwords were previously saved to keychain)
	* Which continuous integration system you want to use. (Options: Travis CI / Pro / Enterprise / CircleCI, or Other)
	* [Travis only] Whether you want to test a single node.js version (e.g. - 8) or multiple node.js versions (e.g. - 4, 6, 8, etc.)
1. npm Add User
	* Runs `npm adduser` with the npm information provided to generate a `.npmrc`
	* Parses the npm token from the `.npmrc` for future use
1. Create GitHub Personal Token
	* Logs into GitHub using the username and password provided
	* Creates (and saves for later use) a [GitHub Personal Access Token](https://github.com/settings/tokens) with the following permissions: *repo, read:org, repo:status, repo_deployment, user:email, write:repo_hook*
1. Update your `package.json`
	* Set `version` field to `0.0.0-development` (`semantic-release` will set the version for you automatically)
	* Add a `semantic-release` script: `"semantic-release": "semantic-release"`
	* Add `semantic-release` as a `devDependency`
	* Add or overwrite the [`repository` field](https://docs.npmjs.com/files/package.json#repository)

## Travis CI

### Versions 4.1.0+
`semantic-release-cli` does not perform any additional Travis-specific steps, but the cli output will provide a [link](https://github.com/semantic-release/semantic-release/blob/master/docs/03-recipes/travis.md) for assistance integrating Travis and `semantic-release-cli`.

### Prior to version 4.1.0
`semantic-release-cli` performs the following additional steps:
1. Overwrite your `.travis.yml` file
	* `after_success`: `npm install -g travis-deploy-once` and `travis-deploy-once "npm run semantic-release"`: run `semantic-release` exactly once after all builds pass
	* Set other sane defaults: `cache: directories: ~/.npm`, `notifications: email: false`
1. Login to Travis CI to configure the package. This step requires your module to define a valid, case-sensitive
[`repository` field](https://docs.npmjs.com/files/package.json#repository).
	* Enable builds of your repo
	* Add `GH_TOKEN` and `NPM_TOKEN` environment variables in the settings

## CircleCI

For CircleCI, `semantic-release-cli` performs the following additional steps:
1. Create minimal `config.yml` file (if CircleCI was selected)
```yml
version: 2
jobs:
  build:
    docker:
      - image: 'circleci/node:latest'
    steps:
      - checkout
      - run:
        name: install
        command: npm install
      - run:
        name: release
        command: npm run semantic-release || true
```
2. Login to CircleCI to configure the package
	* Enable builds of your repo
	* Add `GH_TOKEN` and `NPM_TOKEN` environment variables in the settings
	
	
## Github Actions

For Github Actions, `semantic-release-cli` performs the following additional step:
* Login to Github to configure the package
	* Add `NPM_TOKEN` environment variables as a secret in the settings

For now you will have to manually modify your existing workflow to add a release step. Here is an example of a small complete workflow `.github/workflows/workflow.yml`:
```yaml
name: CI
on: push
jobs:
  test:
    runs-on: ubuntu-16.04
    steps:
      - uses: actions/checkout@v2
      - uses: bahmutov/npm-install@v1
      - run: npm test
      - name: Release
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: npx semantic-release
```

## Other CI Servers

By default, `semantic-release-cli` supports the popular Travis CI and CircleCI servers. If you select `Other` as your server during configuration, `semantic-release-cli` will print out the environment variables you need to set on your CI server. You will be responsible for adding these environment variables as well as configuring your CI server to run `npm run semantic-release` after all the builds pass.

Note that your CI server will also need to set the environment variable `CI=true` so that `semantic-release` will not perform a dry run. (Most CI services do this by default.) See the `semantic-release` documentation for more details.

## Setting defaults

This package reads your npm username from your global `.npmrc`. In order to autosuggest a username in the future, make sure to set your username there: `npm config set username <username>`.

It also reads your GitHub username from your global `.gitconfig`. In order to autosuggest a username in the future, run `git config --global --add github.username <username>`. If a name isn't defined here, it will default to using your npm username, as it will assume they are identical.

## Contribute

Please contribute! We welcome issues and pull requests.

When committing, please conform to [the semantic-release commit standards](https://github.com/semantic-release/semantic-release#default-commit-message-format).

## License

MIT License
2015 © Christoph Witzko and [contributors](https://github.com/semantic-release/cli/graphs/contributors)

![https://twitter.com/trodrigues/status/509301317467373571](https://cloud.githubusercontent.com/assets/908178/6091690/cc86f58c-aeb8-11e4-94cb-15f15f486cde.png)
