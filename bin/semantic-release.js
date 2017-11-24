#!/usr/bin/env node
/* eslint-disable import/no-unassigned-import */
require('babel-register');
require('babel-polyfill');

require('../src')().catch(() => {
  process.exitCode = 1;
});
