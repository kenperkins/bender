#!/usr/bin/env node

/*
 * bender-repl.js
 *
 * (C) 2013 Clipboard, Inc.
 * MIT LICENSE
 *
 * Bender REPL is the interactive version of bender. It's designed for executing
 * commands within a REPL environment.
 *
 */

var config = require('/usr/local/src/bender-config'),
    REPL = require('./repl/repl').REPL;

var repl = new REPL(config);
