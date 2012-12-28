#!/usr/bin/env node

var config = require('./config'),
    CLI = require('./cli/cli').CommandLine;

var cli = new CLI(config);



