var initialized = false,
    async = require('async'),
    path = require('path');

exports.sync = function(bender, options, callback) {

    if (typeof(options) === 'function') {
        callback = options;
        options = {};
    }

    if (initialized) {
        callback({ error: 'already initialized'});
        return;
    }

    initialized = true;

    // Import our models

    var Server = bender.Server = bender.db.import(getPath('server'));
    var IpAddress = bender.IpAddress = bender.db.import(getPath('ipaddress'));
    var DnsRecord = bender.DnsRecord = bender.db.import(getPath('dnsrecord'));
    var Environment = bender.Environment = bender.db.import(getPath('environment'));
    var Service = bender.Service = bender.db.import(getPath('service'));
    var Domain = bender.Domain = bender.db.import(getPath('domain'));
    var Provider = bender.Provider = bender.db.import(getPath('provider'));

    // Server Associations
    Server
        .hasMany(IpAddress, {as: 'Addresses'})
        .hasMany(Service)
        .belongsTo(Provider)
        .belongsTo(Environment);

    // DNS Associations
    DnsRecord
        .belongsTo(IpAddress)
        .belongsTo(Provider)
        .belongsTo(Domain);

    // Domain associations
    Domain
        .belongsTo(Provider)
        .hasMany(DnsRecord);

    // IP Address Associations
    IpAddress
        .belongsTo(Server)
        .hasMany(DnsRecord);

    // Environment Associations
    Environment
        .belongsTo(Domain, {
            as: 'PrivateDomain',
            foreignKey: 'privateDomainId' })
        .belongsTo(Domain, {
            as: 'PublicDomain',
            foreignKey: 'publicDomainId' })
        .hasMany(Server);

    // Provider Associations
    Provider
        .hasMany(Server)
        .hasMany(Domain)
        .hasMany(DnsRecord);

    // Service Associations
    Service.hasMany(Server);

    if (options.reset) {
        bender.db.drop().done(function(err, result) {
            if (err) {
                callback(err);
                return;
            }

            syncModels();
        });
    }
    else {
        syncModels();
    }

    function syncModels() {
        bender.db.sync().done(callback);
    }
};

function getPath(model) {
    return path.resolve(__dirname, '../models/' + model);
}
