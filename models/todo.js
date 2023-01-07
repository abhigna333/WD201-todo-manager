'use strict';
const {
  Model, Op
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Todo extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Todo.belongsTo(models.User, {
        foreignKey: 'userId'
      })
    }
    static addTodo({title, dueDate}) {
      return this.create({ title: title, dueDate: dueDate, completed: false });
    }
    static async overdue() {
      return await this.findAll({
        where: {
          dueDate: { [Op.lt]: new Date() },
          completed: false,
        },
        order: [["id", "ASC"]],
        
      });
    }

    static async dueToday() {
      return await this.findAll({
        where: { 
          dueDate: new Date(),
          completed: false,
        },
        order: [["id", "ASC"]],
        
      });
    }

    static async dueLater() {
      return await this.findAll({
        where: { 
          dueDate: { [Op.gt]: new Date() },
          completed: false,
        },
        order: [["id", "ASC"]],
      });
    }
    static async completed() {
      return await this.findAll({
        where: {
          completed: true,
        }
      })
    }
    
    markAsCompleted(){
      return this.update({ completed: true });
    }

    setCompletionStatus(val) {
      return this.update({ completed: val });
    }

    static getAllTodos() {
      return this.findAll();
    }

    static remove(id){
      return this.destroy({
        where: {
          id,
        }
      });
    }
  }
  Todo.init({
    title: DataTypes.STRING,
    dueDate: DataTypes.DATEONLY,
    completed: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'Todo',
  });
  return Todo;
};