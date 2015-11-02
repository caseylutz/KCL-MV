//=============================================================================
// KCL - FindEventByName
// KCL_FindEventByName.js
// Version: 1.00
//=============================================================================

var KCL = KCL || {};

//=============================================================================
 /*:
 * @plugindesc This plugin adds a new call to the game interpeter to find
 * events by their name instead of just by their ID.
 *
 * @help
 * This plug-in allows scripters to call out events by either name or ID.
 * To do this, instead of calling GameIntepreter.character(eval(id)) use
 * GameInterpeter.findEvent(target). The findEvent call will be smart enough
 * to check if you're handing in a string or a number and look up the event
 * in the most ideal way. 
 */
//=============================================================================


Game_Map.prototype.getEventByName = function(name) { 
	return this.events().filter(function(e) { 
		return e.event().name.toUpperCase() === name.toUpperCase();
	})[0];
}

Game_Interpreter.prototype.findEvent = function(eventId) {
	if (!isNaN(eventId))
		return this.character(eval(eventId));
	else {
		var v = $gameMap.event(eventId)||$gameMap.getEventByName(eventId);
		if (!v) console.log('FindEventByName: could not locate eventId',eventId);
		return v;
	}
}