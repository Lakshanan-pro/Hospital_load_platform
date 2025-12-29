const { DataTypes } = require("sequelize");
const sequelize = require("../config/db"); // sequelize instance

const Hospital = sequelize.define("Hospital", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  osm_id: {
    type: DataTypes.BIGINT,
    unique: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  latitude: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
  longitude: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: "hospitals",
  timestamps: false,
});

module.exports = Hospital;
