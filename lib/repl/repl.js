var async = require('async'),
    Bender = require('../bender'),
    colors = require('colors')
    repl = require('repl'),
    _ = require('underscore');

require('date-utils');

colors.setTheme({
    silly: 'rainbow',
    input: 'grey',
    verbose: 'cyan',
    prompt: 'grey',
    info: 'green',
    data: 'grey',
    help: 'cyan',
    warn: 'yellow',
    debug: 'blue',
    error: 'red'
});

var REPL = exports.REPL = function(config) {

    if (process.env.USER !== 'root') {
        console.log('Please run as sudo or root');
        process.exit(1);
        return;
    }

    var self = this;

    if (!config) {
        throw new Error('config is required to create a Bender-REPL');
    }

    console.log('\nBender'.bold.yellow);
    console.log('  The server/service management app from Clipboard\n'.data);

    self.config = config;

    self.initialize(function() {
        repl.start({
            prompt: 'Bender [' + self.currentEnvironment.name + '] > ',
            input: process.stdin,
            output: process.stdout,
            terminal: true,
            useColors: true,
            writer: function(obj) {
                if (!obj) {
                    return '';
                }

                return obj.yellow + '\n';
            },
            eval: function(cmd, context, filename, callback) {
                dispatch(cmd, callback);
            }
        });
    });


    function dispatch(cmd, callback) {

        cmd = cmd.substr(1, cmd.length - 2);

        var commands = cmd.split('\n')[0].split(' ');

        if (!commands) {
            callback();
            return;
        }

        switch (commands[0].toLowerCase()) {
            case '':
                callback(null, new Date().toUTCString());
                break;
            case 'help':
                callback();
                break;
            default:
                callback();
        }
    }
};

var core = {
    initialize: function(callback) {
        var self = this;

        var cfg = {
            logLevel : 'verbose',
            fileLog: true
        };

        console.log('Initializing Bender REPL...'.cyan);
        Bender.createClient(_.extend({}, cfg, self.config), function(err, bender) {
            if (err || !bender) {
                console.error('Unable to initialize bender'.bold.red, err);
                process.exit(1);
            }

            self.bender = bender;
            self.log = bender.log;

            self.bender.getEnvironments(function(err, envs) {
                if (err) {
                    self.log.error('Unable to load environments', err);
                    callback(err);
                    return;
                }

                _.each(envs, function(env) {
                     if (env.name === 'mgmt') {
                         self.setEnvironment(env, callback);
                     }
                });
            });

        });
    },

    setEnvironment: function(env, callback) {
        var self = this;

        self.currentEnvironment = env;

        callback();
    }
};

// We break our different modules into different files, then we extend the
// prototype of the client based on the merged functions

var prototype = _.extend({},
    core
);

_.each(prototype, function(value, key) {
    REPL.prototype[key] = value;
});

