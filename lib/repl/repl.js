var async = require('async'),
    Bender = require('../bender'),
    colors = require('colors'),
    program = require('commander'),
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

    repl.start({
        prompt: 'Bender > ',
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
