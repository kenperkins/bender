
exports.Options = {
    listOptions: function(value) {
        switch (value) {
            case 'env':
            case exports.Options.commandOptions.list.environment:
                return exports.Options.commandOptions.list.environment;
                break;
            case 'srv':
            case exports.Options.commandOptions.list.server:
                return exports.Options.commandOptions.list.server;
                break;
            case 'svc':
            case exports.Options.commandOptions.list.service:
                return exports.Options.commandOptions.list.service;
                break;
            case exports.Options.commandOptions.list.provider:
                return exports.Options.commandOptions.list.provider;
                break;
            case exports.Options.commandOptions.list.unprovisionedServer:
                return exports.Options.commandOptions.list.unprovisionedServer;
                break;
            default:
                console.log('No List Option Specified'.bold.red);
                process.exit(1);
        }
    },
    createOptions: function(value) {
        switch (value) {
            case 'env':
            case exports.Options.commandOptions.create.environment:
                return exports.Options.commandOptions.create.environment;
                break;
            case 'srv':
            case exports.Options.commandOptions.create.server:
                return exports.Options.commandOptions.create.server;
                break;
            case 'svc':
            case exports.Options.commandOptions.create.service:
                return exports.Options.commandOptions.create.service;
                break;
            case exports.Options.commandOptions.create.provider:
                return exports.Options.commandOptions.create.provider;
                break;
            default:
                console.log('Invalid Option Specified'.bold.red);
                process.exit(1);
        }
    },
    destroyOptions: function(value) {
        switch (value) {
            case 'env':
            case exports.Options.commandOptions.destroy.environment:
                return exports.Options.commandOptions.destroy.environment;
                break;
            case 'srv':
            case exports.Options.commandOptions.destroy.server:
                return exports.Options.commandOptions.destroy.server;
                break;
            default:
                console.log('Invalid Option Specified'.bold.red);
                process.exit(1);
        }
    },
    serverCommands: {
        whitelist: 'whitelist',
        bootstrap: 'bootstrap',
        update: 'update',
        status: 'status',
        start: 'start',
        stop: 'stop',
        restart: 'restart',
        siteUp: 'siteUp',
        siteDown: 'siteDown'
    },
    commandOptions: {
        list: {
            server: 'server',
            environment: 'environment',
            provider: 'provider',
            service: 'service',
            unprovisionedServer: 'unprovisionedServer'
        },
        create: {
            server: 'server',
            environment: 'environment',
            provider: 'provider',
            service: 'service'
        },
        destroy: {
            server: 'server',
            environment: 'environment',
            service: 'service'
        }
    }
};
