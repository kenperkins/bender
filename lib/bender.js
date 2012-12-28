/*
 * bender.js: A server and service management app
 *
 * (C) 2012 Clipboard, Inc.
 * MIT LICENSE
 *
 */

var bender = exports;

// Expose version through `pkginfo`.
require('pkginfo')(module, 'version', 'author');

// Core functionality
bender.createClient = require('./client/client').createClient;

