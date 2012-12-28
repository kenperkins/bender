module.exports = function(sequelize, DataTypes) {
    return sequelize.define("provider", {
            name: { type: DataTypes.STRING, unique: true }
        },
        {
            classMethods: {

            },
            instanceMethods: {

            }
        });
};