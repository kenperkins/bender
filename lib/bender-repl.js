#!/usr/bin/env node

var config = require('./config'),
    REPL = require('./repl/repl').REPL;

var repl = new REPL(config);
