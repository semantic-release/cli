#!/usr/bin/env node

var cli

/* istanbul ignore next */
try {
  cli = require('../dist/cli')
} catch (e) {
  require('babel/register')
  cli = require('../src/cli')
}

cli(process.argv)
