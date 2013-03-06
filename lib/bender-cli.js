#!/usr/bin/env node

/*
 * bender-cli.js
 *
 * (C) 2013 Clipboard, Inc.
 * MIT LICENSE
 *
 * Bender CLI is the single use version of bender. It's designed for executing
 * a single command and then exiting.
 *
 * For example, 'bender --create server' to create a new server.
 */

var config = require('/usr/local/src/bender-config'),
    CLI = require('./cli/cli').CommandLine;

var cli = new CLI(config);



