#!/usr/bin/env node
/* istanbul ignore next */
try {
  require('../dist')(process.argv)
} catch (err) {
    console.log(err)
}
