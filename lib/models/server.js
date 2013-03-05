var _ = require('underscore');

module.exports = function(sequelize, DataTypes) {
    return sequelize.define("server", {
            name       : DataTypes.STRING,
            status     : DataTypes.STRING,
            providerHostId: DataTypes.STRING,
            providerFlavorId: DataTypes.INTEGER,
            providerImageId: DataTypes.STRING,
            providerRecordId: DataTypes.STRING
        },
        {
            classMethods   : {

            },
            instanceMethods: {
                getPrivateIp: function() {
                    var self = this;

                    if (!self.addresses) {
                        return null;
                    }

                    for (var i = 0; i < self.addresses.length; i++) {
                        var address = self.addresses[i];

                        if (!address.isPublic) {
                            return address.ipAddress;
                        }
                    }
                    return null;
                },

                getFriendlyLabel: function() {
                    var label = this.name;

                    if (this.environment) {
                        label += ' [' + this.environment.name + ']';
                    }

                    return label;
                },

                getFqdn: function(isPublic, callback) {
                    var self = this;
                    if (!this.environment) {
                        this.getEnvironment().done(function(err, environment) {
                            if (err) {
                                callback(err);
                                return;
                            }
                            self.environment = environment;
                            getDomain(isPublic);
                        });
                        return;
                    }
                    getDomain(isPublic);

                    function getDomain(isPublic) {
                        if (isPublic && !self.publicDomain) {
                            self.environment.getPublicDomain().done(function(err, domain) {
                                getFqdn(domain);
                            });
                        }
                        else if (isPublic && self.publicDomain) {
                            getFqdn(self.publicDomain);
                        }
                        else if (!isPublic && !self.privateDomain) {
                            self.environment.getPrivateDomain().done(function(err, domain) {
                                getFqdn(domain);
                            });
                        }
                        else if (!isPublic && self.privateDomain) {
                            getFqdn(self.privateDomain);
                        }
                    }

                    function getFqdn(domain) {
                        callback(null, self.name + '.' + domain.name);
                    }
                }
            }
        });
};