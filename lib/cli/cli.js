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

    if (process.env.USER !== 'root') {
        console.log('Please run as sudo or root');
        process.exit(1);
        return;
    }

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
        .option('--addServices', 'Add services to a server')
        .option('--clearServices', 'Remove all service mappings from a server')
        .option('-c, --create <type>', 'Create entity. Options are [server|environment|provider]', self.createOptions)
        .option('-d, --destroy <type>', 'Delete an entity. Options are [server|environment|provider]', self.destroyOptions)
        .option('--log <level>', 'Configure log level. Options are [debug|verbose|info|warn|error]')
        .option('--server [serverId]', 'Run bender in server exec mode.')
        .option('--command <command>', 'The command to run for server mode. Options are [whitelist|bootstrap]')
        .option('--install [serverId]', 'Install bender on the specified server, or prompt if not specified')
        .option('--update', 'Update all servers for a given environment')
        .option('--updateBender <configPath>', 'Update bender on all servers, with the supplied path for the config')
        .option('--whitelist', 'Update the whitelist for all servers')
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
    else if (self.app.list === self.commandOptions.list.service) {
        self.initialize(function() {
            self.listServices();
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
    else if (self.app.create === self.commandOptions.create.service) {
        self.initialize(function() {
            self.createService();
        });
    }
    else if (self.app.destroy === self.commandOptions.destroy.server) {
        self.initialize(function() {
            self.destroyServer();
        });
    }
    else if (self.app.whitelist) {
        self.initialize(function() {
            self.whitelistServers();
        });
    }
    else if (self.app.updateBender) {
        self.initialize(function() {
            self.updateBenderOnServers(self.app.updateBender);
        });
    }
    else if (self.app.update) {
        self.initialize(function() {
            self.updateEnvironment();
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
                    self.whitelistServer(self.app.server, 'eth1');
                    break;
                case self.serverCommands.bootstrap:
                    self.bootstrap(self.app.server);
                    break;
                case self.serverCommands.update:
                    self.update();
                    break;
                case self.serverCommands.status:
                    self.checkServiceStatus(self.app.server, self.app.service);
                    break;
            }
        });
    }
    else if (self.app.addServices) {
        self.initialize(function() {
            self.addServicesToServer();
        });
    }
    else if (self.app.clearServices) {
        self.initialize(function() {
            self.clearServices();
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

        cfg.fileLog = !!self.app.server;

        console.log('Initializing Bender...'.cyan);
        Bender.createClient(_.extend({}, cfg, self.config), function(err, bender) {
            if (err || !bender) {
                console.error('Unable to initialize bender'.bold.red, err);
                process.exit(1);
            }

            self.bender = bender;
            self.log = bender.log;

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
