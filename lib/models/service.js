module.exports = function(sequelize, DataTypes) {
    return sequelize.define("service", {
            name       : { type: DataTypes.STRING, unique: true },
            type       : DataTypes.STRING,
            doesReload : DataTypes.BOOLEAN,
            serviceName: DataTypes.STRING
        },
        {
            classMethods   : {

            },
            instanceMethods: {

            }
        });
};