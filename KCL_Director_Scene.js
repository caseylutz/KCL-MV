//=============================================================================
// Director
// by DragoonKain
// Last Updated: 2015.10.28
//=============================================================================

var KCL = KCL || {};
KCL.Director = KCL.Director || {};

/*:
 * @plugindesc Direct natural language cutscenes
 * @author DragoonKain
 *
 * @help
 *
 * Game Director is geared towards setting up basic commands that might have
 * required tedious MoveRoute calls to set up. Ever re-positioned your 
 * actors or events only to have your carefully crafted cutscenes fall 
 * apart? Director develops its animations dynamically so there should be
 * minimal need to adjust and re-adjust.
 * 
 * Basic uses are simple. Tell the person or thing that you want to do 
 * what you want it to do. The syntax is built to look like english. The
 * intent is that you're DIRECTing a target TO do something. The simplest 
 * use case is MOVE.
 *
 * DIRECT PLAYER TO MOVE TO [3,12]
 *
 * The use of the word "TO" in this case makes the command very readable but 
 * in some cases it's superfluous. You could shorten the command if you wish:
 *
 * DIRECT PLAYER MOVE [3,12]
 *
 * You can also direct the target to move directly to another target. 
 *
 * DIRECT PLAYER TO MOVE TO EVENT_001
 *
 * In this case, the player will chart a course for EVENT_001. In either case,
 * an event target or a coordinate, the player will use pathfinding to try to
 * move his way to the destination.
 *
 * 
 * Director can also control multiple actors at once. 
 * 
 * DIRECT PLAYER AND ACTOR_001 AND ACTOR_002 TO MOVE TO EVENT_001
 *
 * or alternatively...
 * 
 * DIRECT PLAYER TO MOVE TO EVENT_001 WITH ACTOR_001 AND ACTOR_002
 *
 * You can also chain basic commands together contextually, carrying over the
 * event target(s).
 *
 * DIRECT PLAYER TO MOVE TO EVENT_001 THEN FACE NORTH
 *
 * The key phrase here is "AND THEN". This joins another command to the current
 * direction and carries forward the target.
 *
 * DIRECT PLAYER TO MOVE TO EVENT_001 WITH ACTOR_002 THEN FACE NORTH
 *
 * The key phrase here is again "AND THEN" as "AND" could have also been used
 * to add another sub-target to the command. Note the distinction between using
 * WITH to address multiple actors. When commands are chained together with THEN,
 * the actor(s) are carried over but not any actors joined in with the WITH statement.
 * You could say that WITH is temporary.
 *
 * The Director may also be given commands as well. These are similar natural-
 * language commands but they're for when there is no specific target actor.
 * As an example, most directions will run "in the background" and proceed to 
 * process during your event. You can tell those individual actors to WAIT and
 * thus the command will block condition the direction is finished, or you can 
 * optionally queue up commands and then tell the director to WAIT on all of them.
 *
 * E.g.:
 * 
 * DIRECT PLAYER TO MOVE TO MAP_CENTER
 * DIRECT ACTOR_001 TO FOLLOW PLAYER CONDITION PLAYER IS DONE
 * DIRECT ACTOR_002 TO RUN TO EVENT_002
 * DIRECTOR WAIT ALL
 * 
 * You can also stop direction at any time from your event using the following:
 * 
 * DIRECTOR HALT ALL
 * 
 * Of course these direction commands wouldn't be complete if they couldn't
 * control individual actors.
 *
 * DIRECTOR WAIT ON PLAYER AND ACTOR_001
 * 
 * Using the script a few lines above, this line would wait on the player and 
 * actor_001 but would not wait on actor_002.
 *
 * Plugin Command:
 *   DIRECT <actor> TO <verb> [WITH <sub-actor>] [AND <sub-actor>]
 *   DIRECT <actor> TO HALT
 *   DIRECTOR HALT ALL
 *   DIRECTOR WAIT ALL
 *
 * Target Acquisition:
 *   EventName: String representing the name of an event on the $gameMap.
 *   Id: Numeric representing an event ID on $gameMap.
 *   [X,Y]: Coordinate string representing X,Y coordinates on the map.
 *
 * Basic Verbs:
 *   MOVE
 *   WALK
 *   RUN
 *   DANCE
 *   FACE
 *   TURN
 *   FOLLOW
 *   HALT
 *   WAIT
 *
 * Reserved Words:
 *   These are words which are or may be used by Director to process
 *   command input. For this reason it is not recommended to use any
 *   of these words as the name of an event. Please be careful!
 * 
 *   PLAYER,PARTY,MEMBER,FOLLOWER
 *   LEFT,RIGHT,UP,DOWN,TOP,BOTTOM,SIDE,CENTER,MIDDLE
 *   NORTH,SOUTH,EAST,WEST
 *   FOR,AND,NOR,BUT,OR,YET,SO,TO,IS,AS,NOT
 *   EACH,OTHER,BOTH,EXCEPT
 *   THEN,CONDITION,ALL,NONE,WAIT,WITH,DONE,FINISHED,OVER
 *   STEP,STEPS,AWAY,TOWARD,FROM,BLOCK,BLOCKS,SPACE,
 *   SPACES, SQUARE, SQUARES, DELAY
 *   SET,OPTION,
 *   SECONDS,MINUTES,FRAMES
 */


(function() {

  KCL.Director.SceneDirector = SceneDirector;
  KCL.Director.SceneState = SceneState;

  function SceneState() {
  	this.directions = [];
  	this.actors = [];
  }

  SceneState.prototype.current = function() {
  	return _.first(this.directions);
  }

  SceneState.prototype.advance = function() {
  	this.directions.shift();
  	return _.first(this.directions);
  }

  SceneState.prototype.next = function() {
  	return this.directions[1];	
  }

  SceneState.prototype.push = function(direction) {
  	return this.directions.push(direction);
  }

  SceneState.prototype.hasNext = function() {
  	return !_.isUndefined(this.directions[1]);
  }

  SceneState.prototype.reset = function() {
  	this.directions = [];
  	this.actors = [];
  }

  SceneState.prototype.dispose = function() {
  	_.each(this.actors, function(a) { a.dispose() });
  	this.reset();
  }

  SceneState.prototype.getActors = function() {
  	return this.actors;
  }

  SceneState.prototype.assign = function(direction) {
  	if (direction.hasActor()) {
  		var actors = direction.getActors().concat(direction.getWith());
	  	this.activate(actors);
	  	_.each(actors, function(actor) {
	  		actor.state.push(direction);
	  	});
  	} else {
  		this.directions.push(direction);	
  	}
  }

  SceneState.prototype.activate = function(actor) {
  	if (_.isArray(actor)) {
  		_.each(actor, function(a) {
			this.activate(a);
  		}, this);
  	} else {
  		if (!_.contains(this.actors, actor)) {
  			this.actors.push(actor);
  		}
  	}
  }


  // An RPGMaker Natural Language Cutscene Director
  function SceneDirector() {
    this.verbs = [
      {
        verb: 'MOVE',
        alias: ['HEAD'],
        handler: move,
        actionStateComplete: moveComplete,
        requiresTargetBeforeAdverbs: false,
        adverbs: ['SLOWLY', 'QUICKLY'],
        prepositions: []
      },
      {
        verb: 'WALK',
        handler: move,
        requiresTargetBeforeAdverbs: false,
        adverbs: ['SLOWLY', 'QUICKLY'],
        prepositions: []
      },
      {
        verb: 'RUN',
        handler: move,
        requiresTargetBeforeAdverbs: false,
        adverbs: ['SLOWLY', 'QUICKLY'],
        prepositions: []
      },
      {
        verb: 'FACE',
        handler: face,
        requiresTargetBeforeAdverbs: true,
        adverbs: [],
        prepositions: ['NORTH', 'SOUTH', 'EAST', 'WEST', 'LEFT', 'RIGHT', 'UP', 'DOWN']
      },
      {
        verb: 'TURN',
        handler: face,
        requiresTargetBeforeAdverbs: false,
        adverbs: [],
        prepositions: ['NORTH', 'SOUTH', 'EAST', 'WEST', 'LEFT', 'RIGHT', 'UP', 'DOWN']
      },
      {
        verb: 'FOLLOW',
        handler: follow,
        requiresTargetBeforeAdverbs: true,
        adverbs: ['SLOWLY', 'QUICKLY'],
        prepositions: []
      },
      {
        verb: 'WAIT',
        handler: wait,
        requiresTargetBeforeAdverbs: true,
        adverbs: [],
        prepositions: []
      },
      {
        verb: 'HALT',
        handler: halt,
        requiresTargetBeforeAdverbs: false,
        adverbs: [],
        prepositions: []
      }
    ];

    this.prepositions = [
      {
        name: 'NORTH',
      },
      {
        name: 'SOUTH',
      },
      {
        name: 'EAST',
      },
      {
        name: 'WEST',
      },
      {
        name: 'LEFT',
      },
      {
        name: 'RIGHT'
      },
      {
        name: 'UP'
      },
      {
        name: 'DOWN'
      },
      {
        name: 'TOP',
        requiresTarget: true
      },
      {
        name: 'BOTTOM',
        requiresTarget: true
      },
      {
      	name: 'ABOVE',
      	requiresTarget: true
      }, 
      {
      	name: 'BELOW',
      	requiresTarget: true
      }
    ];

    this.specialTargets = [
    	{
    		name: 'PLAYER',
    		handler: acquirePlayer
    	}
    ]

    this.scene = new SceneState();

    function move(d) {
      console.log('game_director :: move');

      var actors = [];
      if (d.state.getStatus() === KCL.Director.DirectionStates.Init) {
      	d.state.setStatus(KCL.Director.DirectionStates.Running);

      	var speed = 4; // default
      	var freq = 6;

      	switch (d.getVerb().verb) {
      		case 'WALK': 
      			speed = 2;
      			break;
      		case 'RUN':
      			speed = 6;
      			break;
      	}

		if (_.contains(d.getAdverbs(), 'SLOWLY'))
			speed=speed-1;
		else if (_.contains(d.getAdverbs(), 'QUICKLY'))
			speed=speed+1;

      	actors = d.getActors().concat(d.getWith());
      	_(actors)
      		.each(function(actor) {
      			var actionState = d.state.actionState(actor);
      			actionState.originalSpeed = actor.actor.moveSpeed();
      			actionState.originalFrequency = actor.actor.moveFrequency();
      			actionState.setStatus(KCL.Director.ActionStates.Running);

      			console.log('speed',speed,'frequency',freq);
      			actor.actor.setMoveSpeed(speed);
      			actor.actor.setMoveFrequency(freq);
      		}).value();
      } else {
      	actors = _(d.state.actors)
      		.filter(function(actionState) { return actionState.status == KCL.Director.ActionStates.Triggered; })
      		.each(function(actionState) { actionState.setStatus(KCL.Director.ActionStates.Running); })
      		.map(function(actionState) { return actionState.actor })
      		.value();
      }

      if (_.any(actors)) {
      	d.state.setStatus(KCL.Director.DirectionStates.Running);

      	var target = _.first(d.getTargets());
      	var preposition = _.first(d.getPrepositions());
      	var direction = 2;
      	var relativeTarget = false; // whether or not target can be shared

      	if (preposition && preposition.active) {
	      	if (preposition.hasTarget()) {
	      		// use the preposition's target and apply a transform
	      		target = _.first(preposition.getTargets()).preposition(preposition);
	      		d.setTarget(target); // save for state
	      	} else if (target) {
      			// apply the preposition to our primary target
      			target = target.preposition(preposition);
	      	} else {
	      		// maybe the preposition is giving us a direction
	      		direction = preposition.direction();
	      		relativeTarget = true;
	      		preposition.active = false;
	      	}
      	}

      	_.each(actors, function(actor) {
      		var actionState = d.state.actionState(actor);
      		var actionTarget = actionState.target||target;

      		if (relativeTarget) {
      			// target is relative to actor
      			actionTarget = KCL.Director.Target.prototype.fromActor(actor);
      			actionTarget = actionTarget.preposition(preposition);
      			actionState.target = actionTarget;
      		}

	      	if (actionTarget) {
	      		var coords = actionTarget.coords();
	      		direction = actor.actor.findDirectionTo(coords.x, coords.y);
	      		var passable = $gameMap.isPassable(coords.x,coords.y,direction)&&!_.any($gameMap.eventsXyNt(coords.x, coords.y));
	      		var done = passable 
	      			? coords.equals(actor.coords())
	      			: coords.near(actor.coords());
	      		if (!done)
	      			actor.actor.moveStraight(direction);
	      		else {
	      			actionState.setStatus(KCL.Director.ActionStates.Done);
	      			console.log('action_state_done');
	      		}
	      	} else {
	      		actor.actor.moveStraight(direction);
	      	}
      	});


      }
    }

    function moveComplete(d, actor) {
    	if (actor) {
    		console.log('move complete');

    		var actionState = d.actionState(actor);
    		if (_.has(actionState, 'originalSpeed')) {
    			actor.actor.setMoveSpeed(actionState.originalSpeed);
    			actor.actor.setMoveFrequency(actionState.originalFrequency);
    		}
    	}
    }

    function face(d) {
      console.log('game_director :: face', d);
    }

    function follow(d) {
      console.log('game_director :: follow', d);
    }

    function wait(d) {
      console.log('game_director :: wait', d);
    }

    function halt(d) {
      console.log('game_director :: halt', d);
    }

    function acquirePlayer(target) {
    	console.log('acquiring player');
    	return $gameMap._interpreter.character(-1);    	
    }

    this.initialize();
  }

  SceneDirector.prototype = Object.create(KCL.Director.Director.prototype);

  SceneDirector.prototype.initialize = function() {
  	KCL.Director.Director.prototype.initialize.apply(this, arguments);
    _.each(this.verbs, function(v) { this.defineVerb(new KCL.Director.Verb(v)); }, this);
    _.each(this.prepositions, function(p) { this.definePreposition(new KCL.Director.Preposition(p)); }, this);
    _.each(this.specialTargets, function(t) {
    	this.defineSpecialTarget(t.name, t.handler);
    }, this);
  }

  SceneDirector.prototype.getActor = function(target) {
    var actor = KCL.Director.Director.prototype.getActor.apply(this, arguments);
    if (!actor) {
      var actor = this.getGameActor(target);
      if (actor) {
      	if (!actor._actor) 
      		actor._actor = new KCL.Director.Actor(actor);
  		return actor._actor;
      } 
      else return undefined;
    }
    else return actor;
  }


  SceneDirector.prototype.getTarget = function(target) {
    var t = KCL.Director.Director.prototype.getTarget.apply(this, arguments);
    if (!t) {    
      var matches = target.match(/[(\d),(\d)]/);
      if (matches && matches.length==2) {
        console.log('target parses to coordinate string',matches);
        var x = parseInt(matches[0]);
        var y = parseInt(matches[1]);
        console.log('coordinates:',x,y);
        return KCL.Director.Target.prototype.fromCoordinates(x,y);
      } else {
        return KCL.Director.Target.prototype.fromActor(this.getActor(target));
      }
    }
    else return t;
  }

  SceneDirector.prototype.getGameActor = function(target) {
    return this.isSpecialTarget(target) 
      ? this.getSpecialTarget(target)
      : this.getGameEvent(target);
  }

  SceneDirector.prototype.getGameEvent = function(target) {
  	var matches = target.match(/#(\d)/);
  	if (matches && matches.length==1) {
  		var eventid = matches[0];
  		return $gameMap.event(eventid);
  	} else {
  		return _.find($gameMap.events(), function(e) { return e.event().name.toUpperCase() == target });
  	}
  }

  SceneDirector.prototype.fromString = function(string) {
  	var context = KCL.Director.Context.prototype.fromString(string);
  	if (context.current() == 'DIRECT') {
  		context.advance();
  		KCL.Director.$.direct(context);
  	} else if (context.current() == 'DIRECTOR') {
  		context.advance();
  		KCL.Director.$.command(context);
  	}
  }

  SceneDirector.prototype.direct = function(context) {

    if (!context.current()) {
      console.log('Failed to process direction "%s" because nothing was supplied.', context.args().join(" "));
    }
    
    var direction = this.parse(context);

    if (direction.hasVerb() && direction.hasActor()) {
      console.log('director :: parse complete', direction);
      this.scene.assign(direction);
    } else {
      if (!direction.hasActor()) 
        console.warn('Failed to process direction "%s" because an actor could not be identified', context.args().join(" "));
      else if (!direction.hasVerb()) 
        console.warn('Failed to process direction "%s" because no valid verb was identified.', context.args().join(" "));
      return;
    }

    if (context.hasMore()) {
      this.direct(context.slice()); // start a new context, carry in our current actors, set state to VERB.
    }

  }

  SceneDirector.prototype.command = function(context) {

    if (!context.current()) {
      console.log('Failed to process direction "%s" because nothing was supplied.', context.args().join(" "));
    }

    context.setState(KCL.Director.Speech.VERB);

    var direction = this.parse(context);

    if (direction.hasVerb()) {
      console.log('director :: parse complete', direction);
      this.scene.assign(direction);
    } else {
      if (!direction.hasVerb())
        console.warn('Failed to process direction "%s" because no valid verb was identified.', context.args().join(" "));
    }

    if (context.hasMore()) {
      this.command(context.slice());
    }

  }

  SceneDirector.prototype.changeScene = function() {
  	this.scene = new SceneState();
  }

  SceneDirector.prototype.pendingDirections = function(status) {
  	return _(this.scene.actors) 
  		.filter(function(a) {
  			return a.state.current() && a.state.current().state.getStatus() === status 
  		})
  		.map(function(a) { return a.state.current() })
  		.uniq();
  }

  SceneDirector.prototype.tick = function() {

  	// process scene directions
  	if (this.scene.current()) {

  	}

  	// process actor directions
  	_(this.scene.actors)
  		.filter(function(actor) { return !!actor.state.current() })
  		.map(function(actor) { return actor.state.current().state.actionState(actor) })
  		.filter(function(actionState) { return actionState.getStatus() == KCL.Director.ActionStates.Done })
  		.each(function(actionState) {
  			var actor = actionState.actor; // ugly
  			var direction = actor.state.current(); // uglier.

  			if (direction.getVerb().actionStateComplete)
  				direction.getVerb().actionStateComplete.call(this, d, actor);

  			actor.state.advance();

  			direction.state.actorDone(actor);

  			console.log('finishing');

  			if (!direction.state.hasAnyActors()) 
  				direction.state.setStatus(KCL.Director.DirectionStates.Done);
  		}, this).value();

  	// clean up any directions which have finished
  	this.pendingDirections(KCL.Director.DirectionStates.Done) 
  		.each(function(d) {
  			console.log('direction done');
  			_(d.state.actors)
  				.map(function(a) { return a.actor })
  				.each(function(actor) {
  					if (d.getVerb().actionStateComplete)
  						d.getVerb().actionStateComplete.call(this, d, actor);
  					if (actor.state.current() === d)
  						actor.state.advance();
  				})
  				.value();
  		}, this).value();

  	// check any delayed directions
  	this.pendingDirections(KCL.Director.DirectionStates.Delayed)
  		.each(function(d) {
  			// check the Conditions to see if the status should change
  			// to init
  		}).value();

  	// check directions that are stuck in wait() status
  	this.pendingDirections(KCL.Director.DirectionStates.Waiting) 
  		.each(function(d) {
  			d.getVerb().getHandler().call(this, d);
  		}).value();

  	// check directions that need to be initialized()
  	this.pendingDirections(KCL.Director.DirectionStates.Init)
  		.each(function(d) {
  			d.getVerb().getHandler().call(this, d);
  		}).value();
  }

  SceneDirector.prototype.actorTick = function(actor) {
  	var current = actor.state.current();
  	if (current && 
  		(
  			current.state.getStatus() === KCL.Director.DirectionStates.Running ||
  		 	current.state.getStatus() === KCL.Director.DirectionStates.Waiting
  		)
	) {
		var actionState = current.state.actionState(actor);
		if (actionState.getStatus() != KCL.Director.ActionStates.Done) {
  			current.state.setStatus(KCL.Director.DirectionStates.Waiting);
  			actionState.setStatus(KCL.Director.ActionStates.Triggered);
  		}
  	}
  }

  // Teach the Director how to get the location of an Actor.
  KCL.Director.Actor.prototype.coords = function() {
    return new KCL.Director.Coords(this.actor.x, this.actor.y);
  }

  KCL.Director.Actor.prototype.id = function() {
  	var id = this.actor._eventId;
  	if (_.isUndefined(id)) {
  		if (this.actor instanceof Game_Player) {
  			return -1;
  		}
  	}
  }

  KCL.Director.Actor.prototype.moveTo = function(target) {

  }

  KCL.Director.Target.prototype.preposition = function(prepositionalPhrase) {
  	var target = this;
  	var extent = prepositionalPhrase.extent();
  	switch(prepositionalPhrase.getPreposition().getName()) {
  		case 'UP': 
  		case 'NORTH':
  			target = new KCL.Director.Target.prototype.fromCoords(target.coords().shift(0,-extent));
  			break;
  		case 'DOWN':
  		case 'SOUTH':
  			target = new KCL.Director.Target.prototype.fromCoords(target.coords().shift(0,extent));
  			break;
  		case 'RIGHT':
  		case 'EAST':
  			target = new KCL.Director.Target.prototype.fromCoords(target.coords().shift(extent, 0));
  			break;
  		case 'LEFT':
  		case 'WEST':
  			target = new KCL.Director.Target.prototype.fromCoords(target.coords().shift(-extent, 0));
  			break;
  	}
  	return target;
  }

  // calculate a direction from a prepositional phrase
  KCL.Director.PrepositionalPhrase.prototype.direction = function(actor) {
  	if (actor) {
	  	// optionally take an actor's current direction into account
	  	var direction = actor.actor.direction();

	  	return this.direction(); // fuck this for now
  	} else {
  		switch (this.getPreposition().getName()) {
  			case 'UP': 
  			case 'NORTH': 
  				return 8;
  			case 'DOWN': 
  			case 'SOUTH':
  				return 2;
  			case 'RIGHT':
  			case 'EAST':
  				return 6;
  			case 'LEFT': 
  			case 'WEST':
  				return 4;
  		}
  	}
  }

  var _Game_Interpreter_pluginCommand = Game_Interpreter.prototype.pluginCommand;
  Game_Interpreter.prototype.pluginCommand = function(command, args) {
    _Game_Interpreter_pluginCommand.call(this, command, args);

    if (command.toUpperCase() === 'DIRECT') {
      KCL.Director.$.direct(KCL.Director.Context.prototype.fromPluginArgs(args));
    } else if (command.toUpperCase() === 'DIRECTOR') {
      KCL.Director.$.command(KCL.Director.Context.Context.prototype.fromPluginArgs(args));
    }
  };

  var _Game_CharacterBase_initMembers = Game_CharacterBase.prototype.initMembers;
  Game_CharacterBase.prototype.initMembers = function() {
    _Game_CharacterBase_initMembers.call(this);

    this._actor = undefined;
  };

  var _Game_Interpreter_setup = Game_Interpreter.prototype.setup;
  Game_Interpreter.prototype.setup = function() {
  	_Game_Interpreter_setup.apply(this, arguments);

  	KCL.Director.$.changeScene();
  }

  var _Game_Interpreter_update = Game_Interpreter.prototype.update;
  Game_Interpreter.prototype.update = function() {
  	_Game_Interpreter_update.apply(this, arguments);

	KCL.Director.$.tick();	
  }

  var _Game_CharacterBase_updateStop = Game_CharacterBase.prototype.updateStop;
  Game_CharacterBase.prototype.updateStop = function() {
    _Game_CharacterBase_updateStop.call(this);

    if (this._actor)
    	KCL.Director.$.actorTick(this._actor);
  };

  var _Game_Map_initialize = Game_Map.prototype.initialize;
  Game_Map.prototype.initialize = function() {
    _Game_Map_initialize.call(this);
  }

  KCL.Director.$ = new SceneDirector();

})();