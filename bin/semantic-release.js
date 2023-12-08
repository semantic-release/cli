#!/usr/bin/env node

require('../src')().catch(() => {
  process.exitCode = 1;
});
