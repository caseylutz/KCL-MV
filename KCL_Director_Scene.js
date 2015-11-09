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
 * DIRECT PLAYER TO MOVE TO SOME_EVENT
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
 * DIRECT ACTOR_001 TO FOLLOW PLAYER UNTIL PLAYER IS DONE
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
 * 
 * TODO:
 * * Have Scene Waits hold the event system from processing further events.
 * * Support returning multiple actors at a time from a single getActor()
 * * Support the Repeat() directive
 * * Have the context chain ultimately culminate in a linked list so that 
 * *   a repeat directive can repeat a whole chain.
 */


 (function() {

 	KCL.Director.SceneDirector = SceneDirector;
 	KCL.Director.SceneState = SceneState;

 	function SceneState() {
 		this.directions = [];
 		this.commands = [];
 		this.actors = [];

 		this.wait = false;
 	}

 	SceneState.prototype.reset = function() {
 		this.commands = [];
 		this.actors = [];
 	}

 	SceneState.prototype.dispose = function() {
 		_.each(this.actors, function(a) { a.dispose() });
 		this.reset();
 	}

 	SceneState.prototype.getActors = function() {
 		return this.actors;
 	}

 	SceneState.prototype.commandDone = function(direction) {
 		_.remove(this.commands, direction);
 	}

 	SceneState.prototype.done = function(direction) {
 		_.remove(this.directions, direction);
 	}

 	SceneState.prototype.assign = function(direction) {
 		if (direction.hasActor() && direction.getContext().directedTo() === KCL.Director.DirectedTo.Actor) {
 			var actors = direction.getActors().concat(direction.getWith());
 			this.activate(actors);
 			_.each(actors, function(actor) {
 				actor.state.push(direction);
 			});
 			this.directions.push(direction);
 		} else {
 			this.commands.push(direction);  
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
			alias: ['HEAD', 'MOVES', 'HEADS'],
			handler: move,
			actionStateComplete: moveComplete,
			adverbs: ['SLOWLY', 'QUICKLY'],
			prepositions: []
		},
		{
			verb: 'WALK',
			handler: move,
			alias: ['WALKS'],
			actionStateComplete: moveComplete,
			adverbs: ['SLOWLY', 'QUICKLY'],
			prepositions: []
		},
		{
			verb: 'RUN',
			alias: ['RUNS'],
			handler: move,
			actionStateComplete: moveComplete,
			adverbs: ['SLOWLY', 'QUICKLY'],
			prepositions: []
		},
		{
			verb: 'FOLLOW',
			alias: ['FOLLOWS'],
			handler: move,
			actionStateComplete: moveComplete,
			requiresTargetBeforeAdverbs: true,
			defaultAsync: true,
			adverbs: ['SLOWLY', 'QUICKLY'],
			prepositions: []
		},	
		{
			verb: 'FACE',
			alias: ['FACES'],
			handler: face,
			requiresTargetBeforeAdverbs: true,
			adverbs: [],
			prepositions: ['NORTH', 'SOUTH', 'EAST', 'WEST', 'LEFT', 'RIGHT', 'UP', 'DOWN', 'TOWARD', 'AWAY']
		},
		{
			verb: 'TURN',
			alias: ['TURNS'],
			handler: face,
			adverbs: [],
			prepositions: ['NORTH', 'SOUTH', 'EAST', 'WEST', 'LEFT', 'RIGHT', 'UP', 'DOWN', 'TOWARD', 'AWAY']
		},
		{
			verb: 'WAIT',
			handler: wait,
			requiresTargetBeforeAdverbs: true,
			defaultAsync: false,
			adverbs: [],
			prepositions: []
		},
		{
			verb: 'HALT',
			handler: halt,
			interrupt: true,
			adverbs: [],
			prepositions: []
		},
		{
			verb: 'DEFINE',
			handler: define,
			adverbs: ['GROUP'],
			contextSwitches: {
				'default': {
					'NAMED': KCL.Director.Speech.TOKEN
				},
				'token': {
					'AS': KCL.Director.Speech.TARGET
				}
			}
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
			name: 'OVER',
			requiresTarget: true
		},
		{
			name: 'ABOVE',
			requiresTarget: true
		}, 
		{
			name: 'BELOW',
			requiresTarget: true
		},
		{
			name: 'TOWARD',
			requiresTarget: true
		}, 
		{
			name: 'AWAY',
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
			var actors = [];

			if (d.state.getStatus() === KCL.Director.DirectionStates.Init) {
				d.state.setStatus(KCL.Director.DirectionStates.Running);

				var speed = 4; // default
				var freq = 6;
				var persist = false;

				switch (d.getVerb().verb) {
					case 'WALK': 
					speed = 2;
					break;
					case 'RUN':
					speed = 6;
					break;
					case 'FOLLOW':
					speed = 4;
					persist = true;
					d.state.shouldWaitOn(false);
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
					actionState.persist = persist;
					actionState.setStatus(KCL.Director.ActionStates.Running);

					actor.actor.setMoveSpeed(actor.actor.isDashing() ? speed-1 : speed);
					actor.actor.setMoveFrequency(freq);
				}).value();
			} else {
				actors = _(d.state.actionState())
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
						if (preposition.hasAmount()) {
							actionTarget = KCL.Director.Target.prototype.fromActor(actor);
							actionTarget = actionTarget.preposition(preposition);
							actionState.target = actionTarget;
						} else {
							actionState.direction = direction;
						}
					}

					if (actionTarget) {
						var coords = actionTarget.coords();
						var curPos = actor.coords();
						direction = actor.actor.findDirectionTo(coords.x, coords.y);
						var passable = actor.actor.canPass(curPos.x,curPos.y,direction);
						var done = passable 
							? coords.equals(actor.coords())
							: coords.near(actor.coords());

						if (!done) {
							actor.actor.moveStraight(direction);
							done = !actor.actor.isMovementSucceeded();
						} 

						if (actionState.persist) done = false;

						if (d.hasCondition() && d.getCondition().isValid()) {
							done = d.getCondition().isMet(actor, d);
						}

						if (done) {
							actionState.setStatus(KCL.Director.ActionStates.Done);
						}
					} else {
						direction = actionState.direction||direction;
						actor.actor.moveStraight(direction);
						var done = !actor.actor.isMovementSucceeded();

						if (d.hasCondition() && d.getCondition().isValid()) {
							done = condition.isMet(actor, d);
						}

						if (done) {
							actionState.setStatus(KCL.Director.ActionStates.Done);
						}
					}
				});


			}
		}

		function moveComplete(d, actor) {
			console.log('move complete');
			if (actor) {
				var actionState = d.state.actionState(actor);
				if (_.has(actionState, 'originalSpeed')) {
					actor.actor.setMoveSpeed(actionState.originalSpeed);
					actor.actor.setMoveFrequency(actionState.originalFrequency);
				}
			}
		}

		function face(d) {
			if (d.state.getStatus() == KCL.Director.DirectionStates.Init) {
				d.state.setStatus(KCL.Director.DirectionStates.Running);

				var actors = d.getActors().concat(d.getWith());
				var preposition = _.first(d.getPrepositions());
				var relativeDirection = d.getVerb().verb === 'TURN';
				var setDirection = false;
				var lookToward = true;

				_.each(actors, function(actor) {
					// start with ourselves as a reference point
					var target = KCL.Director.Target.prototype.fromActor(actor);

					if (preposition) {
						lookToward = preposition.getPreposition().getName() != 'AWAY';
						if (preposition.hasTarget()) {
							// use the preposition's target and apply the preposition as a transform
							target = _.first(preposition.getTargets()).preposition(preposition);
						} else if (d.hasTarget()) {
							target = _.first(d.getTargets()).preposition(preposition);
						} else {
							if (relativeDirection) {
								// see if the preposition is setting a relative direction
								setDirection = preposition.direction(actor.direction());
							}
							if (!relativeDirection || !setDirection)
								target = target.preposition(preposition);
						}
					} else {
						if (d.hasTarget()) {
							target = _.first(d.getTargets());
						} else {
							// this was not a very good use of the command. 
							console.warn('face command executed with no preposition or target');
							var actionState = d.state.actionState(actor).setStatus(KCL.Director.ActionStates.Done);
						}
					}

					if (setDirection) {
						actor.actor.setDirection(setDirection);
					} else if (target) {
						if (lookToward)
							actor.turnToward(target);
						else
							actor.turnAwayFrom(target);
					}
				});
			} else {
				// Init state pretty much executes the 'face' so now we just need
				// to trigger that we're done on the actionState.
				var actionStates = _(d.state.actionState())
				.filter(function(actionState) { return actionState.status == KCL.Director.ActionStates.Triggered; })
				.each(function(actionState) { actionState.setStatus(KCL.Director.ActionStates.Done); })
				.value();
			}
		}

		function wait(d) {
			if (d.state.getStatus() == KCL.Director.DirectionStates.Init) {
				d.state.setStatus(KCL.Director.DirectionStates.Waiting);

				if (d.getContext().directedTo() === KCL.Director.DirectedTo.Actor) {
					var actors = d.getActors().concat(d.getWith());
					_.each(actors, function(actor) {
						var actionState = d.actionState(actor);

						actionState.setStatus(KCL.Director.ActionStates.Running);
					});
				}					
			}

			if (d.getContext().directedTo() === KCL.Director.DirectedTo.Actor) {
				var actors = d.getActors().concat(d.getWith());
				_.each(actors, function(actor) {
					var actionState = d.actionState(actor);

					if (d.hasTarget()) {
						// we want to wait for all target(s) to have no running/triggered actionStates.
						var done = _(d.getTargets())
							.filter(function(target) { return target.hasActor(); })
							.map(function(target) { return target.getActor() })
							.map(function(actor) { return actor.state.directions })
							.flatten()
							.map(function(direction) { return direction.state.actionState() })
							.reject(function(direction) { return direction === d })
							.every(function(actionState) {
								var status = actionState.getStatus();
								return status != KCL.Director.ActionStates.Running && status != KCL.Director.ActionStates.Triggered
							});
						if (done) 
							actionState.setStatus(KCL.Director.ActionStates.Done);
					} else {
						done = _.every(this.scene.directions, function(direction) {
								var status = direction.state.getStatus();
								return status != KCL.Director.DirectionStates.Running && status != KCL.Director.DirectionStates.Waiting
							});
						if (done) 
							actionState.setStatus(KCL.Director.ActionStates.Done);						
					}
				})
			} else {
				var done = true;
				if (d.hasTarget()) {
					done = _(d.getTargets())
						.filter(function(target) { return target.hasActor(); })
						.map(function(target) { return target.getActor() })
						.map(function(actor) { return actor.state.directions })
						.flatten()
						.map(function(direction) { return direction.state.actionState() })
						.reject(function(direction) { return direction === d })
						.every(function(actionState) {
							var status = actionState.getStatus();
							return status != KCL.Director.ActionStates.Running && status != KCL.Director.ActionStates.Triggered
						});
					if (done) 
						actionState.setStatus(KCL.Director.ActionStates.Done);
				} else {
					var that = this;
					done = _(this.scene.directions)
						.takeWhile(function(direction) {
							return direction !== d
						})
						.filter(function(direction) { return direction.state.shouldWaitOn() })
						.every(function(direction) {
							var status = direction.state.getStatus();
							return 
								 	status != KCL.Director.DirectionStates.Running && 
									status != KCL.Director.DirectionStates.Waiting &&
									status != KCL.Director.DirectionStates.Init;
						});
				}
				this.scene.wait = !done;
				if (done) {
					d.state.setStatus(KCL.Director.DirectionStates.Done);
				}
			}
		}

		function halt(d) {
			if (d.state.getStatus() == KCL.Director.DirectionStates.Init)
				d.state.setStatus(KCL.Director.DirectionStates.Running);

			if (d.getContext().directedTo() === KCL.Director.DirectedTo.Director) {
				if (!d.hasTarget()) {
					// this is easy - burn the world!
					_(this.scene.directions) 
					.map(function(direction){return _.values(direction.state.actionState())})
					.flatten()
					.each(function(actionState) {
						actionState.setStatus(KCL.Director.ActionStates.Done);
					}).value();
				} else {
					_(d.getTargets())
					.filter(function(target) { return target.hasActor() })
					.map(function(target) { return target.getActor() })
					.map(function(actor) { return actor.state.directions })
					.flatten()
					.map(function(direction) { return direction.state.actionState() })
					.flatten()
					.each(function(actionState) {
						actionState.setStatus(KCL.Director.ActionStates.Done);
					}).value();
				}
			} else {
				var actor = d.getActor();
				_(actor.state.directions)
				.map(function(direction) { return direction.state.actionState() })
				.flatten()
				.each(function(actionState) {
					actionState.setStatus(KCL.Director.ActionStates.Done);
				}).value();
			}
			d.state.setStatus(KCL.Director.DirectionStates.Done);
		}

		function define(d) {
			if (d.getContext().directedTo() === KCL.Director.DirectedTo.Director) {
				if (_.contains(d.getAdverbs(), 'GROUP')) {
					var groupName = _.first(d.getTokens());
					if (groupName) {
						if (d.hasTarget()) {
							this.defineSpecialTarget(groupName, function(){return d.getTargets()});
						} else {
							console.warn('director :: define "group" could not identify any targets');
						}
					} else {
						console.warn('director :: define "group" must specify a group name');
					}
				}
			}
			d.state.setStatus(KCL.Director.DirectionStates.Done);
		}

		function acquirePlayer(target) {
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


	SceneDirector.prototype.pendingDirections = function() {
		return _(this.scene.directions)
		.takeWhile(function(direction, idx) {
			return idx==0 ||
			direction.isAsync()
		})
	}

	SceneDirector.prototype.pendingSceneDirections = function() {
		return _(this.scene.commands) 
		.takeWhile(function(direction, idx) {
			return idx==0 || 
			direction.isAsync()
		});
	}

	SceneDirector.prototype.cleanUpStageDirections = function() {
		_(this.scene.commands)
		.filter(function(d) { return d.state.status === KCL.Director.DirectionStates.Done })
		.each(function(d) {
			this.scene.commandDone(d);
		}, this).value();		
	}

	SceneDirector.prototype.cleanUpActionStates = function() {
		this.pendingDirections()
		.filter(function(d) {
			return d.state.status !== KCL.Director.DirectionStates.Init
		})
		.each(function(direction) {
			_(direction.state.actionState())
			.values()
			.filter(function(actionState) { return actionState.getStatus() == KCL.Director.ActionStates.Done })
			.each(function(actionState) {
				var actor = actionState.actor;

				if (direction.getVerb().actionStateComplete)
					direction.getVerb().actionStateComplete.call(this, direction, actor);

				actor.state.advance();

				direction.state.actorDone(actor);

				if (!direction.state.hasAnyActors()) 
					direction.state.setStatus(KCL.Director.DirectionStates.Done);
			}, this).value();
		}, this).value();		
	}

	SceneDirector.prototype.cleanUpDirections = function() {
		_(this.scene.directions) 
		.filter(function(d) {
			return d.state.status === KCL.Director.DirectionStates.Done 
		})
		.each(function(d) {
			_(d.state.actionState())
			.map(function(a) { return a.actor })
			.each(function(actor) {
				if (d.getVerb().actionStateComplete)
					d.getVerb().actionStateComplete.call(this, d, actor);
				if (actor.state.current() === d)
					actor.state.advance();
			})
			.value();
			this.scene.done(d);
		}, this).value();		
	}

	SceneDirector.prototype.checkDelays = function() {
		_(this.scene.directions) 
		.filter(function(d) {
			return d.state.status === KCL.Director.DirectionStates.Delayed 
		})
		.each(function(d) {
			// check the Conditions to see if the status should change
			// to init
		}).value();		
	}

	SceneDirector.prototype.updateWaiting = function() {
		_(this.scene.directions) 
		.filter(function(d) {
			return d.state.status === KCL.Director.DirectionStates.Waiting;
		})
		.each(function(d) {
			d.getVerb().getHandler().call(this, d);
		}).value();		
	}

	SceneDirector.prototype.initDirections = function() {
		this.pendingDirections()
		.filter(function(d) {
			return d.state.status == KCL.Director.DirectionStates.Init 
		})
		.each(function(d) {
			this.debug('director :: initializing actor command', d.getVerb().verb);
			d.getVerb().getHandler().call(this, d);
		}, this).value();		
	}

	SceneDirector.prototype.updateStageDirections = function() {
		_(this.scene.commands)
		.filter(function(d) { return d.state.status === KCL.Director.DirectionStates.Init ||
									 d.state.status === KCL.Director.DirectionStates.Waiting })
		.each(function(d) {
			this.debug('director :: executing scene command', d.getVerb().verb);
			d.getVerb().getHandler().call(this, d);
		}, this).value();

	}

	SceneDirector.prototype.tick = function() {
		if (this.scene.directions.length > 0) {

			// clean up any directions which are finished
			this.cleanUpStageDirections();

			// clean up completed actionStates
			this.cleanUpActionStates();
			
			// clean up any directions which have finished
			this.cleanUpDirections();

			// check any delayed directions
			this.checkDelays();

			// check directions that are stuck in wait() status
			this.updateWaiting();

			// check directions that need to be initialized()
			this.initDirections();

		}

		if (this.scene.commands.length > 0) {

			// execute scene commands waiting execution
			this.updateStageDirections();

		}

		if (this.scene.wait) {
			$gameMap._interpreter.wait(1);
		}
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

	SceneDirector.prototype.getActor = function(target) {
		var actor = KCL.Director.Director.prototype.getActor.apply(this, arguments);
		if (!actor) {
			var actor = this.getGameActor(target);
			if (actor) {
				if (!actor._actor) 
					actor._actor = new SceneActor(actor, target);
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

	SceneDirector.prototype.fromString = function(str) {
		var strings = _.isArray(str) ? str : [str];
		_.each(strings, function(string) {
			var context = KCL.Director.Context.prototype.fromString(string);
			var directTo = context.current() === 'DIRECT' 
				? KCL.Director.DirectedTo.Actor
				: KCL.Director.DirectedTo.Director;
			context.directedTo(directTo);
			context.advance();
			KCL.Director.$.direct(context);
		})
	}

	SceneDirector.prototype.direct = function(context) {

		if (!context.current()) {
			console.log('Failed to process direction "%s" because nothing was supplied.', context.args().join(" "));
		}
		
		var toDirector = context.directedTo() === KCL.Director.DirectedTo.Director;

		if (toDirector) context.setState(KCL.Director.Speech.VERB);

		var direction = this.parse(context);
		
		toDirector = context.directedTo() === KCL.Director.DirectedTo.Director; // this can change during parse		

		if (direction.hasVerb() && (toDirector||direction.hasActor())) {
			console.log('director :: parse complete', direction);
			this.scene.assign(direction);
		} else {
			if (!toDirector && !direction.hasActor()) 
				console.warn('Failed to process direction "%s" because an actor could not be identified', context.args().join(" "));
			else if (!direction.hasVerb()) 
				console.warn('Failed to process direction "%s" because no valid verb was identified.', context.args().join(" "));
			return;
		}

		if (context.hasMore()) {
			this.direct(context.slice()); // start a new context, carry in our current actors, set state to VERB.
		}

	}

	SceneDirector.prototype.changeScene = function() {
		this.scene = new SceneState();
	}

	SceneDirector.prototype.describeScene = function() {
		console.log('Scene');

		if (_.any(this.scene.commands)) {
			console.log('Scene Commands');
			console.log(
				_.map(this.scene.commands, function(direction) {
					return {
						'verb': direction.getVerb().verb,
						'status': direction.state.getStatus()
					}
				}));
		}

		if (_.any(this.scene.actors)) {
			console.log('Scene Actors');
			_(this.scene.actors)
				.map(function(actor) {
					return {
						'id': actor.id(),
						'name': actor.getName(),
						'commands': actor.state.directions.length,
						'current': actor.state.current()?actor.state.current():'nothing',
					}					
				})
				.tap(function(actors) { console.log(actors)})
				.value();
		}

		if (_.any(this.scene.directions)) {
			console.log('Directions');
			_(this.scene.directions) 
				.each(function(direction, idx) {
					console.log('direction',idx);
					console.log({
						'verb': direction.getVerb().verb,
						'status': direction.state.getStatus()
					});
					_(direction.state.actionState())
						.values()
						.map(function(actionState) {
							return {
								'actor': actionState.actor.getName(),
								'status': actionState.getStatus()
							}
						})
						.tap(function(actionStates) {console.log(actionStates)})
						.value();
				})
				.value();
		}
	}

	function SceneActor(actor, name) {
		KCL.Director.Actor.call(this, actor, name);
	}

	SceneActor.prototype = Object.create(KCL.Director.Actor.prototype);
	SceneActor.prototype.constructor = SceneActor; 
	Object.defineProperty(SceneActor.prototype, 'constructor', { 
		enumerable: false, 
		value: SceneActor 
	});

	// Teach the Director how to get the location of an Actor.
	SceneActor.prototype.coords = function() {
		return new KCL.Director.Coords(this.actor.x, this.actor.y);
	}

	SceneActor.prototype.id = function() {
		var id = this.actor._eventId;
		if (_.isUndefined(id)) {
			if (this.actor instanceof Game_Player) {
				return -1;
			}
		}
	}

	SceneActor.prototype.turnToward = function(target) {
		// shamelessly ripped from rpg_object
		var coords = target.coords();
		var sx = this.actor.deltaXFrom(coords.x);
		var sy = this.actor.deltaYFrom(coords.y);
		if (Math.abs(sx) > Math.abs(sy)) {
			this.actor.setDirection(sx > 0 ? 4 : 6);
		} else if (sy !== 0) {
			this.actor.setDirection(sy > 0 ? 8 : 2);
		}
	}

	SceneActor.prototype.turnAwayFrom = function(target) {
		// shamelessly ripped from rpg_object
		var coords = target.coords();
		var sx = this.actor.deltaXFrom(coords.x);
		var sy = this.actor.deltaYFrom(coords.y);
		if (Math.abs(sx) > Math.abs(sy)) {
			this.actor.setDirection(sx > 0 ? 6 : 4);
		} else if (sy !== 0) {
			this.actor.setDirection(sy > 0 ? 2 : 8);
		}
	}

	KCL.Director.Target.prototype.preposition = function(prepositionalPhrase) {
		var target = this;
		var extent = prepositionalPhrase.extent();
		switch(prepositionalPhrase.getPreposition().getName()) {
			case 'UP': 
			case 'NORTH':
			case 'TOP':
			target = new KCL.Director.Target.prototype.fromCoords(target.coords().shift(0,-extent));
			break;
			case 'DOWN':
			case 'SOUTH':
			case 'BOTTOM':
			case 'BELOW':
			target = new KCL.Director.Target.prototype.fromCoords(target.coords().shift(0,extent));
			break;
			case 'RIGHT':
			case 'EAST':
			target = new KCL.Director.Target.prototype.fromCoords(target.coords().shift(extent, 0));
			break;
			case 'LEFT':
			case 'WEST':
			target = new KCL.Director.Target.prototype.fromCoords(target.coords().shift(-extent, 0));
			case 'OVER': 
			target = new KCL.Director.Target.prototype.fromCoords(target.coords());
			break;
		}
		return target;
	}

	// calculate a direction from a prepositional phrase
	KCL.Director.PrepositionalPhrase.prototype.direction = function(alreadyFacing) {
		if (!_.isUndefined(alreadyFacing)) {
			// optionally take a current direction into account
			switch (this.getPreposition().getName()) {
				case 'LEFT': {
					switch (alreadyFacing) {
						case 2:
						return 6;
						break;
						case 4:
						return 2;
						break;
						case 6:
						return 8;
						break;
						case 8:
						return 4;
						break;
					}
				}
				case 'RIGHT': {
					switch (alreadyFacing) {
						case 2:
						return 4;
						break;
						case 4:
						return 8;
						break;
						case 6:
						return 2;
						break;
						case 8:
						return 6;
						break;
					}
				}
				case 'AROUND': {
					return 10-alreadyFacing;
				}
			}
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
			KCL.Director.$.direct(KCL.Director.Context.prototype.fromPluginArgs(args).directedTo(KCL.Director.DirectedTo.Actor));
		} else if (command.toUpperCase() === 'DIRECTOR') {
			KCL.Director.$.direct(KCL.Director.Context.prototype.fromPluginArgs(args).directedTo(KCL.Director.DirectedTo.Director));
		}

		this.wait(1);
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
		KCL.Director.$.tick(); 

		_Game_Interpreter_update.apply(this, arguments);
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