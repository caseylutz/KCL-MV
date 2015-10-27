//=============================================================================
// SelfSwitch
// by DragoonKain
// Last Updated: 2015.10.26
//=============================================================================

/*:
 * @plugindesc Allows events or players to do smart Pathfinding
 * @author DragoonKain
 *
 * @help
 *
 * Plugin Command:
 *  SELFSWITCH <event_name> [switch=A] [value=1]
 */

(function() {
  var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
  Game_Interpreter.prototype.pluginCommand = function(command, args) {
    _Game_Interpreter_pluginCommand.call(this, command, args);

    if (command.toUpperCase() === 'SELFSWITCH') {
      target = this.findEvent 
        ? this.findEvent(args[0])
        : this.character(eval(args[0]));

      var sw = 'A';
      if (args.length > 1) {
        sw = args[1];
      }

      var value = 1;
      if (args.length > 2) {
        value = args[2];
      }

      if (isNaN(value)) {
        if (value.toUpperCase() == 'ON') 
          value = 1;
        else if (value.toUpperCase() == 'OFF')
          value = 0;
      }

      if (target) {
        var key = [$gameMap._mapId, target._eventId, sw];
        $gameSelfSwitches.setValue(key, value);
      }
    }
  };
})();
