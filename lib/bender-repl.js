#!/usr/bin/env node

var config = require('/usr/local/src/bender-config'),
    REPL = require('./repl/repl').REPL;

var repl = new REPL(config);
