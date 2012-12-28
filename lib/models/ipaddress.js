module.exports = function(sequelize, DataTypes) {
    return sequelize.define("ipAddress", {
            ipAddress   : { type: DataTypes.STRING, unique: true},
            isPublic    : DataTypes.BOOLEAN,
            type        : DataTypes.STRING
        },
        {
            classMethods   : {

            },
            instanceMethods: {

            }
        });
};