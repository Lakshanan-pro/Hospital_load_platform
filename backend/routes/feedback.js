const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const Hospital = require("./Hospital");

const Feedback = sequelize.define("Feedback", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  hospital_id: {
    type: DataTypes.INTEGER,
    references: {
      model: Hospital,
      key: "id",
    },
  },
  actual_wait: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  comment: {
    type: DataTypes.TEXT,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: "feedback",
  timestamps: false,
});

Hospital.hasMany(Feedback, { foreignKey: "hospital_id" });
Feedback.belongsTo(Hospital, { foreignKey: "hospital_id" });

module.exports = Feedback;
