#!/usr/bin/env node
require('babel-register');
require('babel-polyfill');

require('../src')().catch(() => {
  process.exitCode = 1;
});
