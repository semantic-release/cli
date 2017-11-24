#!/usr/bin/env node
require('babel-register')({only: 'semantic-release-cli/src'});
require('babel-polyfill');

require('../src')().catch(() => {
  process.exitCode = 1;
});
