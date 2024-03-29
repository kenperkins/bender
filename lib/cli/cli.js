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

    self.app = program;
    self.config = config;

    self.app
        .version(Bender.version)
        .option('-l, --list <type>', 'List entities by type. Options are [server|environment|provider|service] ', self.listOptions)
        .option('--addServer', 'Add a server to bender')
        .option('--addServices', 'Add services to a server')
        .option('--clearServices', 'Remove all service mappings from a server')
        .option('-c, --create <type>', 'Create entity. Options are [server|environment|provider|service]', self.createOptions)
        .option('-d, --destroy <type>', 'Delete an entity. Options are [server|environment|provider]', self.destroyOptions)
        .option('--log <level>', 'Configure log level. Options are [debug|verbose|info|warn|error]')
        .option('--server [serverId]', 'Run bender in server exec mode.')
        .option('--command <command>', 'The command to run for server mode. Options are [whitelist|bootstrap]')
        .option('--service <serviceId>', 'The service for use in service mode.')
        .option('--install [serverId]', 'Install bender on the specified server, or prompt if not specified')
        .option('--update', 'Update all servers for a given environment')
        .option('--updateBender', 'Update bender on all servers')
        .option('--whitelist', 'Update the whitelist for all servers')
        .option('--getAddress <server>', 'Get address by server friendly name')
        .option('--environment <env>', 'Get environment by name for use with get address')
        .parse(process.argv);

    if (self.app.log && self.app.log !== 'silent') {
        console.log('\nBender'.bold.yellow);
        console.log('  The server/service management app from Clipboard\n'.data);
    }

    // Allow getAddress to run without sudo, all other functions require it
    // This function is run by the "shell" proxy, and as such, we can't always
    // control if it's run as sudo
    if (self.app.environment && self.app.getAddress) {
        self.initialize(function() {
            self.getServerAddress(self.app.getAddress, self.app.environment);
        });
        return;
    }

    if (process.env.USER !== 'root') {
        console.log('Please run as sudo or root');
        process.exit(1);
        return;
    }

    if (self.app.list === self.commandOptions.list.environment) {
        self.initialize(function() {
            self.listEnvironments();
        });
    }
    else if (self.app.list === self.commandOptions.list.server) {
        self.initialize(function() {
            self.listServers();
        });
    }
    else if (self.app.list === self.commandOptions.list.unprovisionedServer) {
        self.initialize(function() {
            self.listUnprovisonedServers();
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
            self.updateBenderOnServers();
        });
    }
    else if (self.app.update) {
        self.initialize(function() {
            self.runPuppetOnServers();
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
                case self.serverCommands.siteUp:
                    self.siteUp();
                    break;
                case self.serverCommands.siteDown:
                    self.siteDown();
                    break;

                case self.serverCommands.status:
                case self.serverCommands.stop:
                case self.serverCommands.restart:
                case self.serverCommands.start:
                    self.execServiceCommand(self.app.server, self.app.service, self.app.command);
                    break;

                default:
                    if (self.app.command.indexOf('swapin') !== -1) {
                        // this is brittle, we know it - Ken '13
                        var serverId = self.app.command.split('-')[1];
                        self.addToUpstream(serverId, 3000, 5, 30);
                    }
                    else if (self.app.command.indexOf('swapout') !== -1) {
                        var serverId = self.app.command.split('-')[1];
                        self.removeFromUpstream(serverId);
                    }
                    break;
            }
        });
    }
    else if (self.app.addServices) {
        self.initialize(function() {
            self.addServicesToServer();
        });
    }
    else if (self.app.addServer) {
        self.initialize(function() {
            self.addServer();
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

        if (cfg.logLevel !== 'silent') {
            console.log('Initializing Bender...'.cyan);
        }
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
