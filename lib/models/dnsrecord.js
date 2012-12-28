module.exports = function(sequelize, DataTypes) {
    return sequelize.define("dnsRecord", {
            name    : { type: DataTypes.STRING, unique: true },
            data    : DataTypes.STRING,
            type    : DataTypes.STRING,
            ttl     : DataTypes.INTEGER,
            providerRecordId : DataTypes.STRING
        },
        {
            classMethods   : {

            },
            instanceMethods: {

            }
        });
};