var Bender = require('../bender'),
    Options = require('./options').Options,
    List = require('./list').List,
    Create = require('./create').Create,
    Destroy = require('./destroy').Destroy,
    Server = require('./server').Server,
    Util = require('./util').Util,
    colors = require('colors'),
    program = require('commander'),
    _ = require('underscore');

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

var CommandLine = exports.CommandLine = function(config) {

    var self = this;

    if (!config) {
        throw new Error('config is required to create a CommandLine');
    }

    console.log('\nBender'.bold.yellow);
    console.log('  The server/service management app from Clipboard\n'.data);

    self.app = program;
    self.config = config;

    self.app
        .version(Bender.version)
        .option('-l, --list <type>', 'List entities by type. Options are [server|environment|provider] ', self.listOptions)
        .option('-c, --create <type>', 'Create entity. Options are [server|environment|provider]', self.createOptions)
        .option('-d, --destroy <type>', 'Delete an entity. Options are [server|environment|provider]', self.destroyOptions)
        .option('--log <level>', 'Configure log level. Options are [debug|verbose|info|warn|error]')
        .option('--server [serverId]', 'Run bender in server exec mode.')
        .option('--command <command>', 'The command to run for server mode. Options are [whitelist|bootstrap]')
        .option('--install [serverId]', 'Install bender on the specified server, or prompt if not specified')
        .option('--reset-database', 'Forcefully Reset the Bender database')
        .parse(process.argv);

    if (self.app.resetDatabase) {
        self.resetDatabase();
    }
    else if (self.app.list === self.commandOptions.list.environment) {
        self.initialize(function() {
            self.listEnvironments();
        });
    }
    else if (self.app.list === self.commandOptions.list.server) {
        self.initialize(function() {
            self.listServers();
        });
    }
    else if (self.app.list === self.commandOptions.list.provider) {
        self.initialize(function() {
            self.listProviders();
        });
    }
    else if (self.app.list === self.commandOptions.list.provider) {
        self.initialize(function() {
            self.listEnvironments();
        });
    }
    else if (self.app.create === self.commandOptions.create.environment) {
        self.initialize(function() {
            self.createEnvironment();
        });
    }
    else if (self.app.create === self.commandOptions.create.server) {
        self.initialize(function() {
            self.createServer();
        });
    }
    else if (self.app.create === self.commandOptions.create.provider) {
        self.initialize(function() {
            self.createProvider();
        });
    }
    else if (self.app.destroy === self.commandOptions.destroy.server) {
        self.initialize(function() {
            self.destroyServer();
        });
    }
    else if (self.app.install) {
        self.initialize(function() {
            self.installBender(self.app.install);
        });
    }
    else if (self.app.server && self.app.command) {
        self.initialize(function() {
            switch (self.app.command) {
                case self.serverCommands.whitelist:
                    // hard coded for now
                    self.whitelistServers('eth1');
                    break;
                case self.serverCommands.bootstrap:
                    self.bootstrap(self.app.server);
                    break;

            }
        });
    }
    else {
        self.app.help();
    }

    return self;
};

var core = {
    initialize: function(callback) {
        var self = this;

        var cfg = {};

        if (self.app.log) {
            cfg.logLevel = self.app.log;
        }

        console.log('Initializing Bender...'.cyan);
        Bender.createClient(_.extend({}, cfg, self.config), function(err, bender) {
            if (err || !bender) {
                console.error('Unable to initialize bender'.bold.red, err);
                process.exit(1);
            }

            self.bender = bender;

            callback();
        });
    }
};

// We break our different modules into different files, then we extend the
// prototype of the client based on the merged functions

var prototype = _.extend({},
    core,
    Options,
    List,
    Create,
    Destroy,
    Server,
    Util
);

_.each(prototype, function(value, key) {
    CommandLine.prototype[key] = value;
});
