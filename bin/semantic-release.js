#!/usr/bin/env node
/* eslint-disable import/no-unassigned-import */
require('babel-register')({only: 'semantic-release-cli/src'});
require('babel-polyfill');

require('../src')().catch(() => {
  process.exitCode = 1;
});
