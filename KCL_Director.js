//=============================================================================
// Director
// by DragoonKain
// Last Updated: 2015.10.28
//=============================================================================

var KCL = KCL || {};
KCL.Director = KCL.Director || {};

/*:
 * @plugindesc Natural language processor
 * @author DragoonKain
 *
 * @help
 *
 * Director is a "natural language" command processor for RPG Maker MV plugin 
 * development. It's meant to be an extensible grammar parser that parses
 * simple commands into "stage directions" which can be applied to "actors".
 * 
 * For detailed help on how to use the director for end-users, please see
 * Director_Game. Director is primarily for use by plugin developers. 
 * 
 * Director is based around the simple concept of parts of speech delimited by
 * certain key words called "context switches" that tell the command parser
 * what kinds of information to look for. Parts of speech include the ACTOR
 * (in english: Noun/Nominal/Subject), the VERB, the ADVERB (modifies the verb),
 * the TARGET(s) (in english, the DIRECT OBJECT), PREPOSITIONS (tells the verb
 * where or to what extent), DURATION (for how long), WITH (additional subjects),
 * and CONDITIONS (until when).
 * 
 * The most basic formula involves just a VERB. This is called a COMMAND and the 
 * intent is to directly tell the DIRECTOR something. Maybe this affects all 
 * (known) actors or the entire scene/game. The second most basic formula involves
 * an ACTOR + VERB. This is telling an ACTOR to DO something. From there it only 
 * gets as complex as you want it to get. 
 * 
 * This combination of ACTOR + VERB and everything else is boiled down into a 
 * single packet of state called a "direction". 
 *
 * In the end everything is going to end up as a callback 
 * whereby when an actor needs "direction" and encounters your 
 * verb it will pass its state and the "direction" to you, the developer, to 
 * handle the action. 
 * 
 * As the developer you will be responsible for determining the state of your
 * direction and the direction will be "active" until you end it or until the
 * director is told to end it. 
 * 
 */

(function() {

  var Speech = {
    ACTOR: 'actor',
    VERB: 'verb',
    ADVERB: 'adverb',
    DEFAULT: 'default',
    WITH: 'with',
    TARGET: 'target',
    CONDITION: 'condition',
    PREPOSITION: 'preposition',
    DURATION: 'duration',
    REPEAT: 'repeat',
    TOKEN: 'token',
    DELAY: 'delay',
    END: 'end',
    END_ASYNC: 'endAsync'
  };


  // These are words which when processed in the given
  // states will be completely ignored.
  var FillerWords = {
    'actor': [
      'THE',
      'WITH'
    ],
    'verb': [
      'TO'
    ],
    'preposition': [
      'TO',
      'THE',
      'OF'
    ]
  };

  // 
  // These are words which, when encountered, will
  // change the current context state to a new state.
  var ContextSwitches = {
    'default': {
      'WITH': Speech.WITH,
      'TO': Speech.TARGET,
      'TOWARD': Speech.TARGET,
      'CONDITION': Speech.CONDITION,
      'UNTIL': Speech.CONDITION,
      'FOR': Speech.DURATION,
      'THEN': Speech.END,
      'WHILE': Speech.END_ASYNC,
      'REPEAT': Speech.REPEAT,
    },
    'preposition': {
      'WITH': Speech.WITH,
      'TO': Speech.TARGET,
      'UNTIL': Speech.CONDITION,
      'FOR': Speech.DURATION,
      'THEN': Speech.END,
      'WHILE': Speech.END_ASYNC
    }
  };

  var PrepositionalUnits = [
    'SQUARE',
    'SQUARES',
    'SPACE',
    'SPACES',
    'BLOCKS',
    'TILE',
    'TILES',
    'FOOT',
    'FEET',
    'METER',
    'METERS',
    'STEP',
    'STEPS',
  ];

  var PrepositionalUnitConversions = {
    'METER': 3,
    'METERS': 3,
  };

  var DurationUnits = [
    'FRAMES',
    'SECONDS',
    'MINUTES'
  ];

  var RepeaterUnits = [
    'TIMES'
  ];

  // States which must share the same context switches as the Default.
  // This is useful if states are optional or could end indeterminately. 
  var DefaultStates = [Speech.ADVERB];  

  var DirectionStates = {
    Init: 'init',
    Delayed: 'delay',
    Running: 'running',
    Waiting: 'waiting',
    Done: 'done'
  };

  var ActionStates = {
    Init: 'init',
    Triggered: 'triggered',
    Running: 'running',
    Done: 'done'
  }

  var DirectedTo = {
    Actor: 'ACTOR',
    Director: 'DIRECTOR'
  }
                           
  var AND = 'AND';
                                         
  var FPS = 60; 

  // Set up the global object namespace
  KCL.Director.ActionState = ActionState;
  KCL.Director.ActionStates = ActionStates;
  KCL.Director.Actor = Actor;
  KCL.Director.ActorState = ActorState;
  KCL.Director.Coords = Coords;
  KCL.Director.Condition = Condition;
  KCL.Director.Context = Context;
  KCL.Director.ContextSwitches = ContextSwitches;
  KCL.Director.DefaultStates = DefaultStates;
  KCL.Director.Delay = Delay;
  KCL.Director.DirectedTo = DirectedTo;
  KCL.Director.Direction = Direction;
  KCL.Director.DirectionState = DirectionState;
  KCL.Director.DirectionStates = DirectionStates;
  KCL.Director.Director = Director;
  KCL.Director.DirectorFactory = DirectorFactory;
  KCL.Director.Duration = Duration;
  KCL.Director.DurationUnits = DurationUnits;
  KCL.Director.FillerWords = FillerWords;
  KCL.Director.Preposition = Preposition;
  KCL.Director.PrepositionalPhrase = PrepositionalPhrase;
  KCL.Director.PrepositionalUnitConversions = PrepositionalUnitConversions;
  KCL.Director.PrepositionalUnits = PrepositionalUnits;
  KCL.Director.Speech = Speech;
  KCL.Director.Target = Target;
  KCL.Director.Verb = Verb;

  function Verb(config) {
    config = _.defaults({}, config, {
      verb: null,
      alias: [],
      handler: null,
      actionStateComplete: null,
      requiresTargetBeforeAdverbs: false,
      defaultAsync: false,
      adverbs: [],
      prepositions: [],
      initialState: Speech.ADVERB,
      fillerWords: [],
      contextSwitches: {},
      interrupt: false
    });

    this.verb = config.verb;
    this.alias = config.alias;
    this.handler = config.handler;
    this.actionStateComplete = config.actionStateComplete;
    this.requiresTargetBeforeAdverbs = config.requiresTargetBeforeAdverbs;
    this.defaultAsync = config.defaultAsync;
    this.adverbs = config.adverbs;
    this.prepositions = config.prepositions;
    this.initialState = config.initialState;
    this.fillerWords = config.fillerWords;
    this.contextSwitches = config.contextSwitches;
    this.interrupt = config.interrupt;
  }

  Verb.prototype.getVerb = function() {
    return this.verb;
  }

  Verb.prototype.getAliases = function() {
    return this.alias;
  }

  Verb.prototype.getHandler = function() {
    return this.handler;
  }

  Verb.prototype.getAdverbs = function() {
    return this.adverbs;
  }

  Verb.prototype.getPrepositions = function() {
    return this.prepositions;
  }

  Verb.prototype.isAllowedAdverb = function(adverb) {
    return _.contains(this.adverbs, adverb);
  }

  Verb.prototype.isAllowedPreposition = function(preposition) {
    return _.contains(this.prepositions, preposition);
  }

  // Prepositions are a bitch.
  // Prepositions can come in many flavors.
  // MOVE LEFT <- Keep going left.
  // MOVE LEFT 3 SPACES <- Go left only 3 spaces
  // MOVE LEFT 3 SPACES FROM <TARGET> <- Move 3 spaces to the left of target X,Y
  function Preposition(config) {
    this._config = _.defaults({}, config, {
      name: null,
      acceptsTarget: true,
      acceptsAmount: true,
      acceptsUnit: true,
      requiresTarget: false,
      requiresAmount: false,
      requiresUnit: false,
      contextSwitch: true
    });
  }

  Preposition.prototype.getName = function() {
    return this._config.name;
  }

  Preposition.prototype.canAcquireTarget = function() {
    return this._config.acceptsTarget;
  }

  Preposition.prototype.triggersContextSwitch = function() {
    return this._config.contextSwitch;
  }

  var ConditionComparator = {
    IS: 'IS',
    EQ: 'EQUALS',
    LT: 'LESSTHAN',
    GT: 'GREATERTHAN',
  }

  // An Condition specifies a conditional reason to end a direction.
  function Condition() {
    this._next = undefined;
    this._target = undefined;
    this._comparator = undefined;
    this._value = undefined;
    this._preposition = undefined;
  }

  Condition.prototype.hasNext = function() { 
    return !!this._next;
  }

  Condition.prototype.getNext = function() {
    return this._next;
  }

  Condition.prototype.next = function(comparator, condition) {
    this._next = condition;
  }

  Condition.prototype.isValid = function() {
    return this._target && this._comparator && this._value &&
           this._target.isActor();
  }

  Condition.prototype.hasTarget = function() {
    return !!this._target;
  }

  Condition.prototype.getTarget = function() {
    return this._target;
  }

  Condition.prototype.setTarget = function(target) {
    this._target = target;
  }

  Condition.prototype.setComparator = function(comparator) {
    this._comparator = comparator;
  }

  Condition.prototype.setValue = function(value) {
    this._value = value;
  }

  Condition.prototype.isMet = function(actor, direction) {
    if (!this.isValid()) return true;

    var target = this.getTarget().getActor();

    switch (this._comparator) {
      case ConditionComparator.IS: {
        if (this._value === ActionStates.Done.toUpperCase()) {
          // see if the target is done
          var actionStates = _(target.state.actionStates)
            .values()
            .takeWhile(function(actionState) { return actionState._direction !== direction })
            .value();
          return !_.any(actionStates) ||
            _.every(actionStates, function(actionState) { return actionState.getStatus() === ActionStates.Done });
        } 
        break;
      }
    }
  }

  // Used to generate a Director object or obtain the current Singleton.
  var directorFactory = new DirectorFactory();
  function DirectorFactory() {
    this._director = null;
  }

  DirectorFactory.prototype.getDirector = function() {
    if (!this._director) { return new Director(); }
    else return this._director;
  }

  // 
  // Defines an Actor as the target of one of our stage directions.
  function Actor(actor, name) {
    this.actor = actor;
    this.state = new ActorState();
    this.name = name;
  }

  // returns back the underlying engine id of the actor
  Actor.prototype.id = function() {
  }

  Actor.prototype.getName = function() {
    return this.name || this.id();
  }

  // returns back the underlying actor's coordinate position
  Actor.prototype.coords = function() {
    return {
      x: 0,
      y: 0
    }    
  }

  Actor.prototype.direction = function() {

  }

  // resets the actorState.
  Actor.prototype.reset = function() {
    this._state = new ActorState();
  }

  // correctly disposes of this actor to prevent any circular references
  Actor.prototype.dispose = function() {
    this.reset();
    this.actor = undefined;
  }

  function ActorState() {
    this.directions = [];
    this.actionStates = {

    }
  }

  ActorState.prototype.current = function() {
    return this.directions[0];
  }

  ActorState.prototype.advance = function() {
    this.directions.shift();
    return this.current();
  }

  ActorState.prototype.next = function() {
    return this.directions[1];  
  }

  ActorState.prototype.push = function(direction) {
    return this.directions.push(direction);
  }

  ActorState.prototype.hasNext = function() {
    return !_.isUndefined(this.directions[1]);
  }

  ActorState.prototype.actionState = function(direction, state) {
    this.actionStates[direction._id] = state;
  }

  ActorState.prototype.actionStateComplete = function(direction) {
    delete this.actionStates[direction._id];
  }

  ActorState.prototype.getActionStates = function() {
    return this.actionStates;
  }

  // Used to store information about the target Target of the current
  // stage direction.
  function Target() {
    this._x = 0;
    this._y = 0;
    this._actor = undefined;
  }

  // Builds a target from a Coords object
  Target.prototype.fromCoords = function(coords) {
    var t = new Target();
    t._x = coords.x;
    t._y = coords.y;
    t._actor = undefined;
    return t;
  }

  // Builds a target from x, y coordinates
  Target.prototype.fromCoordinates = function(x,y) {
    var t = new Target();
    t._x = x;
    t._y = y;
    t._actor = undefined;
    return t;
  }

  // Builds a target from an actor
  Target.prototype.fromActor = function(actor) {
    if (actor) {
      var t = new Target();
      t._actor = actor;
      var coords = actor.coords();
      t._x = coords.x;
      t._y = coords.y;
      return t;
    }
    return undefined;
  }

  // determines whether or not hte target is a fixed coordinate
  // or subject to continuous change
  Target.prototype.isFixed = function() {
    return !this._actor;
  }

  // retrieve x,y coordinates of the target. if this is simply a coordinate
  // pair then there's nothing special here. if it's an actor then it will
  // retrieve the x,y position of that actor.
  Target.prototype.coords = function() {
    if (this._actor) {
      return this._actor.coords();
    } else {
      return new Coords(this._x, this._y);
    }
  }

  // apply a prepositional phrase to a target to acquire a new set of
  // mutated coordinates. if the preposition is valid to perform this
  // operation, the original target is not mutated. instead, a new target
  // is returned based on the mutation.
  Target.prototype.preposition = function(prepositionalPhrase) {
    return this; // if target compares reference equality then 
                 // no mutation occurred
  }

  Target.prototype.isActor = function() {
    return !!this._actor;
  }

  Target.prototype.getActor = function() { 
    return this._actor;
  }

  function Coords(x, y) {
    this.x = x;
    this.y = y;
  }

  Coords.prototype.equals = function(coords) {
    return this.x == coords.x && this.y == coords.y;
  }

  Coords.prototype.near = function(coords, xradius, yradius) {
    if (_.isUndefined(xradius)) xradius = 1;
    if (_.isUndefined(yradius)) yradius = xradius;
    return Math.abs(this.x - coords.x) <= xradius &&
           Math.abs(this.y - coords.y) <= yradius;
  }

  Coords.prototype.shift = function(x, y) {
    return new Coords(this.x+x, this.y+y);
  }

  // A stage direction is a collection of properties extrapolated from
  // a command context. This collection of properties can be used to 
  // process a command on an actor.
  function Direction(context) {
    this._actors = [];
    this._verb = undefined;
    this._adverbs = [];
    this._condition = undefined;
    this._prepositions = [];
    this._with = [];
    this._duration = undefined;
    this._delay = undefined;
    this._targets = [];
    this._context = context;
    this._repeat = undefined;
    this._async = false;
    this._tokens = [];
    this._id = _.uniqueId();
    this.state = new DirectionState(this);
  }

  Direction.prototype.setActors = function(actors) {
    this._actors = actors;
  }

  Direction.prototype.clearActors = function() {
    this._actors = [];
  }

  Direction.prototype.addActor = function(actor) {
    this._actors = this._actors.concat(actor);
  }

  Direction.prototype.hasActor = function() {
    return this._actors.length > 0;
  }

  Direction.prototype.getActors = function() {
    return this._actors;
  }

  Direction.prototype.setVerb = function(verb) {
    this._verb = verb;
    if (this._context) {
      this._context.setVerb(verb);
    }
  }

  Direction.prototype.hasVerb = function() {
    return !_.isUndefined(this._verb);
  }

  Direction.prototype.getVerb = function() {
    return this._verb;
  }

  Direction.prototype.addAdverb = function(adverb) {
    this._adverbs.push(adverb);
  }

  Direction.prototype.getAdverbs = function() {
    return this._adverbs;
  }

  Direction.prototype.addPreposition = function(preposition) {
    this._prepositions.push(preposition);
  }

  Direction.prototype.getPrepositions = function() {
    return this._prepositions;
  }

  Direction.prototype.setDuration = function(duration) {
    this._duration = duration;
  }

  Direction.prototype.hasDuration = function() {
    return this._duration != undefined;
  }

  Direction.prototype.getDuration = function() {
    return this._duration;
  }

  Direction.prototype.hasDelay = function() {
    return !!this._delay;
  }

  Direction.prototype.getDelay = function() {
    return this._delay;
  }

  Direction.prototype.setDelay = function(delay) {
    this._delay = delay;
  }

  Direction.prototype.setCondition = function(condition) {
    this._condition = condition;
  }

  Direction.prototype.hasCondition = function() {
    return this._condition != undefined;
  }

  Direction.prototype.getCondition = function() {
    return this._condition;
  }

  Direction.prototype.addWith = function(actor) {
    this._with.push(actor);
  }

  Direction.prototype.hasWith = function() {
    return this._with.length > 0;
  }

  Direction.prototype.getWith = function() {
    return this._with;
  }

  Direction.prototype.hasTarget = function() {
    return _.any(this._targets);
  }

  Direction.prototype.getTargets = function() {
    return this._targets;
  }

  Direction.prototype.addTarget = function(target) {
    return this._targets.push(target);
  }

  Direction.prototype.setTarget = function(target) {
    if (_.isArray(target)) this._targets = target;
    else this._targets = [target];
  }

  Direction.prototype.getState = function() {
    return this.state;
  }

  Direction.prototype.getStatus = function() {
    return this.state.getStatus();
  }

  Direction.prototype.setRepeat = function(repeat) {
    this._repeat = repeat;
  }

  Direction.prototype.doesRepeat = function() {
    return !_.isUndefined(this._repeat);
  }

  Direction.prototype.getRepeat = function() {
    return this._repeat;
  }

  Direction.prototype.isAsync = function() {
    return this._async;
  }

  Direction.prototype.setAsync = function(async) {
    this._async = async;
  }

  Direction.prototype.addToken = function(token) {
    this._tokens.push(token);
  }

  Direction.prototype.getTokens = function() {
    return this._tokens;
  }

  Direction.prototype.getContext = function() {
    return this._context;
  }

  function ActionState(actor, direction) {
    this._direction = direction;
    this.status = ActionStates.Init;
    this.data = {};
    this.actor = actor;
  }

  ActionState.prototype.getStatus = function() {
    return this.status;
  }

  ActionState.prototype.setStatus = function(status) {
    this.status = status;
  }

  function DirectionState(direction) {
    this._direction = direction;
    this.status = DirectionStates.Init;
    this.waitOn = true;
    this.data = {};
    this._actionStates = {};
  }

  DirectionState.prototype.getStatus = function() {
    return this.status;
  }

  DirectionState.prototype.setStatus = function(status) {
    this.status = status;
  }

  DirectionState.prototype.actionState = function(actor) {
    if (_.isUndefined(actor)) return this._actionStates;

    var actionState = this._actionStates[actor.id()];
    if (!actionState) {
      actionState = new ActionState(actor, this._direction);
      this._actionStates[actor.id()] = actionState;
      actor.state.actionState(this._direction, actionState);
    }
    return actionState;
  }

  DirectionState.prototype.actorDone = function(actor) {
    delete this._actionStates[actor.id()];
  }

  DirectionState.prototype.hasAnyActors = function() {
    return _.any(this._actionStates);
  }

  DirectionState.prototype.shouldWaitOn = function(waitOn) {
    if (_.isUndefined(waitOn))
      return this.waitOn;
    else
      this.waitOn = waitOn;
  }

  // A prepositional phrase is going to declare in what direction,
  // how far, and by what unit or some combination thereof.
  // Some prepositions also declare targets.
  function PrepositionalPhrase(preposition) {
    this.preposition = preposition;
    this.active = true;
    this.amount = undefined;
    this.unit = undefined;
    this.targets = [];
  }

  PrepositionalPhrase.prototype.getPreposition = function() {
    return this.preposition;
  }

  PrepositionalPhrase.prototype.setAmount = function(amt) {
    if (_.isFinite(amt)) {
      this.amount = amt;
    } else if (_.isString(amt)) {
      var i = parseInt(amt,10);
      this.setAmount(i);
    }
  }

  PrepositionalPhrase.prototype.setUnit = function(unit) {
    if (_.contains(PrepositionalUnits, unit)) 
      this.unit = unit;
  }

  PrepositionalPhrase.prototype.hasAmount = function() {
    return this.amount !== undefined;
  }

  PrepositionalPhrase.prototype.hasUnit = function() {
    return this.unit !== undefined;
  }

  PrepositionalPhrase.prototype.addTarget = function(target) {
    return this.targets.push(target);
  }

  PrepositionalPhrase.prototype.getTargets = function() {
    return this.targets;
  }

  PrepositionalPhrase.prototype.hasTarget = function() {
    return _.any(this.targets);
  }

  PrepositionalPhrase.prototype.isComplete = function() {

  }

  // calculate units * amount
  PrepositionalPhrase.prototype.extent = function() {
    if (this.hasAmount()) {
      var conversion = PrepositionalUnitConversions[this.unit]||1;
      return conversion*this.amount;
    } else 
      return 1; // powers directionals like LEFT, RIGHT, UP, DOWN
  }


  // A durational phrase is going to declare how long something
  // should take place.
  function Duration() {
    this._duration = undefined;
    this._unit = undefined;
  }

  Duration.prototype.getFrames = function() {
    switch(this._unit) {
      case DurationUnits.SECONDS: {
        return this._duration * FPS;
        break;
      }
      case DurationUnits.MINUTES: {
        return this._duration * FPS * 60;
        break;
      }
      case DurationUnits.FRAMES: {
        return this._duration;
        break;
      }
    }
  }

  Duration.prototype.setUnit = function(unit) {
    if (_.contains(['SECOND', 'SECONDS'], unit)) 
      this._unit = DurationUnits.SECONDS;
    else if (_.contains(['MINUTE', 'MINUTES'])) 
      this._unit = DurationUnits.MINUTES;
    else if (_.contains(['FRAME', 'FRAMES']))
      this._unit = DurationUnits.FRAMES;
  }

  Duration.prototype.setDuration = function(duration) {
    if (_.isFinite(duration)) 
      this._duration = duration;
    else if (_.isString(duration)) {
      var i = parseInt(duration, 10);
      this.setDuration(i);
    }
  }

  function Delay() {
    this._duration = undefined;
  }

  function Repeat() {
    this._amount = undefined;
    this._unit = undefined;
  }

  Repeat.prototype.getAmount = function() {
    return this._amount;
  }

  Repeat.prototype.hasAmount = function() {
    return !_.isUndefined(this._amount);
  }

  Repeat.prototype.setAmount = function(amount) {
    if (_.isFinite(amt)) {
      this.amount = amt;
    } else if (_.isString(amt)) {
      var i = parseInt(amt,10);
      this.setAmount(i);
    }
  }

  Repeat.prototype.getUnit = function(unit) {
    return this._unit;
  }

  Repeat.prototype.setUnit = function(unit) {
    if (_.has(RepeaterUnits, unit)) 
      this._unit = unit;
  }

  Repeat.prototype.hasUnit = function() {
    return !_.isUndefined(this._unit);
  }

  // A context is an active command sequence that can be processed
  // into a stage direction.
  function Context(args) {
    this._directedTo = undefined;
    this._args = args;
    this._index = 0;
    this._state = Speech.ACTOR;
    this._verb = undefined;
    this._actors = [];
    this._deferred = [];
    this._unknown = [];
    this._retry = false; // ignore one advance
    this._previousVerb = undefined;
    this._isDeferred = false;
    this._requestAsync = false;
    this._chained = false;
    this.data = null; // holds data about the active state
  }

  Context.prototype.fromPluginArgs = function(pluginArgs) {
    var args = Array.prototype.slice.call(pluginArgs).join(" ");
    return Context.prototype.fromString(args);
  }

  Context.prototype.fromString = function(string) {
    var args = string.match(/[\w#!]+|"(?:\\"|[^"])+"|\((?:\\\(|[^\)])+\)/g).map(function(a) { return a.toUpperCase(); });
    return new Context(args);
  }

  Context.prototype.directedTo = function(directedTo) {
    if (!_.isUndefined(directedTo)) {
      this._directedTo = directedTo;
      return this;
    } else {
      return this._directedTo;
    }
  }

  Context.prototype.current = function() {
    return this._args[this._index];
  }

  Context.prototype.next = function() {
    return this._args[this._index+1];
  }

  Context.prototype.advance = function() {
    if (!this._retry)
      return this._args[++this._index];
    else {
      this._retry = false;
      return this._args[this._index];
    }
  }

  Context.prototype.retry = function() {
    this._retry = true;
  }

  Context.prototype.args = function() {
    return this._args;
  }

  Context.prototype.hasMore = function() {
    return this._args.length > this._index;
  }

  Context.prototype.hasNext = function() {
    return this._args.length > this._index+1;
  }

  Context.prototype.setState = function(state) {
    this._state = state;
    this.data = null;
    if (_.any(this._deferred)) {
      if (this._state != Speech.END && this._state != Speech.END_ASYNC) {
        Array.prototype.splice.apply(this._args, [this._index+1, 0].concat(this._deferred));
      } else {
        this.addUnknown(this._deferred);
      }
      this._deferred = [];
    }
  }

  Context.prototype.getState = function() {
    return this._state;
  } 

  Context.prototype.setVerb = function(verb) {
    this._verb = verb;
  }

  Context.prototype.getVerb = function() {
    return this._verb;
  }

  Context.prototype.hasVerb = function() {
    return !_.isUndefined(this._verb);
  }

  Context.prototype.getActors = function() {
    return this._actors;
  }

  Context.prototype.addActor = function(actor) {
    this._actors = this._actors.concat(actor);
  }

  Context.prototype.hasPreviousVerb = function() {
    return !_.isUndefined(this._previousVerb);
  }

  Context.prototype.getPreviousVerb = function() {
    return this._previousVerb;
  }

  Context.prototype.setPreviousVerb = function(verb) {
    this._previousVerb = verb;
    return this;
  }

  Context.prototype.slice = function() {
    var args = Array.prototype.slice.call(this._args, this._index);
    var context = new Context(args);
    context.addActor(this.getActors());
    context.setState(Speech.VERB);
    context.directedTo(this.directedTo());
    context.setRequestingAsync(this.isRequestingAsync());
    context.setPreviousVerb(this.getVerb());
    context._chained = true;
    return context;
  }

  Context.prototype.defer = function() {
    // defer the current word until the next context switch
    var deferred = _.pullAt(this._args, this._index);
    this._deferred = this._deferred.concat(deferred);
    this.retry(); // forego the next advance to stay with the new non-deferred word
    return this;
  }

  Context.prototype.isDeferred = function() {
    return this._isDeferred;
  }

  Context.prototype.setDeferred = function(deferred) {
    this._deferred = false;
  }

  Context.prototype.addUnknown = function(wordOrWords) {
    this._unknown = this._unknown.concat(wordOrWords);
    return this;
  }

  Context.prototype.isRequestingAsync = function() {
    return this._requestAsync;
  }

  Context.prototype.setRequestingAsync = function (yesNo) {
    this._requestAsync = yesNo;
  }

  Context.prototype.isChained = function() {
    return this._chained;
  }

  Context.prototype.mutate = function(value) {
    this._args[this._index] = value;
  }

  function Director() {
  }

  Director.prototype.initialize = function() {
    this._specialTargets = {};
    this._verbs = {};
    this._prepositions = {};
    this._debug = true;
  }

  Director.prototype.getActor = function(target) {
  }

  Director.prototype.isSpecialTarget = function(target) {
    return this._specialTargets.hasOwnProperty(target);
  }

  Director.prototype.getSpecialTarget = function(target) {
    return this._specialTargets[target].call(this, target);
  }

  Director.prototype.getTarget = function(Target) {
  }

  Director.prototype.getVerb = function(verb) {
    var registeredVerb = this._verbs[verb];
    if (typeof(registeredVerb) !== 'undefined') {
      return registeredVerb;
    }
  }

  Director.prototype.defineVerb = function(verb) {
    this._verbs[verb.getVerb()] = verb;
    _.each(verb.getAliases(), function(a) { this._verbs[a] = verb; }, this);
  }

  Director.prototype.getPreposition = function(preposition) {
    var registeredPreposition = this._prepositions[preposition];
    if (!_.isUndefined(registeredPreposition)) {
      return registeredPreposition;
    }
  }

  Director.prototype.definePreposition = function(preposition) {
    this._prepositions[preposition.getName()] = preposition;
    if (preposition.triggersContextSwitch())
      ContextSwitches.default[preposition.getName()] = Speech.PREPOSITION;
  }

  Director.prototype.defineSpecialTarget = function(name, func) {
    this._specialTargets[name.toUpperCase()] = func;
  }

  Director.prototype.parse = function(context) {
    var direction = new Direction(context);

    if (context.isRequestingAsync()) {
      direction.setAsync(context.isRequestingAsync);
      context.setRequestingAsync(false);
    }

    if (context.isChained() && _.any(context.getActors()) && !this.getActor(context.current())) {
      direction.setActors(context.getActors());
    }

    while (context.getState() != Speech.END && context.hasMore()) {
      if (!this.isFiller(context)) {
        this.contextSwitch(context);
        var unknown = false;

        switch (context.getState()) {
          case Speech.ACTOR: {
            var actor = this.getActor(context.current());

            if (actor) {
              context.addActor(actor);
              direction.addActor(actor);
            }

            if (context.hasNext() && context.next() == AND)
              context.advance(); // skip the "and", stay in current state.
            else
              context.setState(Speech.VERB); // Looking for a verb next

            break;
          }
          case Speech.VERB: {
            if (context.current().endsWith('!')) {
              context.mutate(context.current().substring(0,context.current().length-1));
              context.directedTo(KCL.Director.DirectedTo.Director);
            }

            var verb = this.getVerb(context.current());
            if (verb) {
              direction.setVerb(verb);
            } else if (context.isChained && this.getActor(context.current())) {
              context.setState(Speech.ACTOR);
              context.retry();
            } else if (context.hasPreviousVerb()) {
              verb = context.getPreviousVerb();
              direction.setVerb(verb);
              context.retry();
            } else {
              context.setState(Speech.DEFAULT);
            }

            if (verb) {
              direction.setAsync(direction.isAsync()||verb.defaultAsync);

              if (!_.any(verb.getAdverbs()) || verb.requiresTargetBeforeAdverbs)
                context.setState(Speech.DEFAULT);
              else
                context.setState(verb.initialState);
            }
            break;
          }
          case Speech.ADVERB: {
            if (_.contains(direction.getVerb().getAdverbs(), context.current()))
              direction.addAdverb(context.current());
            else 
              context.defer();
            break;
          }
          case Speech.DEFAULT: {
            if (!direction.hasTarget() && this.getTarget(context.current())) {
              // retry the current context as a TARGET context.
              context.setState(Speech.TARGET);
              context.retry();
            } else {
              if (context.isDeferred()) {
                // even after changing state the deferred word could not
                // be contextualized. 
                unknown = true;
                context.addUnknown(context.current());
                console.warn('director :: default state processed unknown content', context.current());
              } else {
                context.defer();
              }
            }
            break;
          }
          case Speech.PREPOSITION: {
            if (context.data) {
              var phrase = context.data;
              if (phrase.getPreposition().canAcquireTarget() && this.getTarget(context.current())) {
                phrase.addTarget(this.getTarget(context.current()));
              } else if (!phrase.hasAmount()) {
                // the second part of a preposition should be the amount
                phrase.setAmount(context.current());
              } else if (!phrase.hasUnit()) {
                phrase.setUnit(context.current());
              }
            } else {
              var preposition = this.getPreposition(context.current());
              if (preposition) {
                var phrase = new PrepositionalPhrase(preposition);
                context.data = phrase;
                direction.addPreposition(phrase);
              }
              else {
                console.warn('director :: unknown prepositional', context.current());
              }
            }
            break;
          }
          case Speech.DURATION: {
            // the first part of a duration is the context switch
            if (!context.data) {
              context.data = new Duration();
            } else {
              var duration = context.data;

              if (!duration.hasDuration()) {
                duration.setDuration(context.current());
              } else if (!duration.hasUnit()) {
                duration.setUnit(context.current());
              }

              if (duration.hasDuration() && duration.hasUnit())
                direction.setDuration(duration);
            }
            break;
          }
          case Speech.TARGET: {
            var target = this.getTarget(context.current());

            if (target) {
              direction.addTarget(target);
            }

            if (context.hasNext() && context.next() == AND) {
              // skip the 'and' and stay in this context to look for another target
              context.advance();
            } else {
              if (direction.hasVerb() && direction.getVerb().requiresTargetBeforeAdverbs) 
                context.setState(Speech.ADVERB);
              else
                context.setState(Speech.DEFAULT);
            }

            break;
          }
          case Speech.WITH: {
            if (context.data) {
              var target = this.getActor(context.current());

              if (target) {
                direction.addWith(target);
              }

              if (context.hasNext() && context.next() == AND) {
                // skip the 'and' and stay in this context to look for another target
                context.advance();
              } else {
                context.setState(Speech.DEFAULT);
              }
            } else {
              context.data = direction._with;
            }
            break;
          }
          case Speech.CONDITION: {
            if (!context.data) {
              context.data = new Condition();
              direction.setCondition(context.data);
            } else {
              var condition = context.data;

              if (!condition.hasTarget()) {
                condition.setTarget(this.getTarget(context.current()));
              } else if (!condition._comparator) {
                condition.setComparator(context.current())
              } else if (!condition._value) {
                condition.setValue(context.current());
              }

              if (condition.isValid()) 
                context.setState(Speech.DEFAULT);
            }
            break;
          }
          case Speech.REPEAT: {
            if (!context.data) {
              context.data = new Repeat();
            } else {
              var repeat = context.data;
              if (!repeat.hasAmount()) {
                repeat.setAmount(context.current());
              } else {
                repeat.setUnit(context.current());
              }

              if (repeat.hasAmount() && repeat.hasUnit()) {
                context.setState(Speech.DEFAULT);
              }
            }
            break;
          }
          case Speech.TOKEN: {
            if (!context.data) {
              context.data = true;
            } else {
              direction.addToken(context.current());
            }
            break;
          }
          case Speech.END: {
            break;
          }
          case Speech.END_ASYNC: {
            context.setRequestingAsync(true);
            context.setState(Speech.END);
            break;
          }
        }
      }

      if (context.isDeferred() && !unknown) {
        context.setDeferred(false);
      }

      context.advance();
    }

    return direction;

  }

  Director.prototype.contextSwitch = function(context) {
    var currentState = _.contains(DefaultStates, context.getState())
      ? Speech.DEFAULT
      : context.getState();
    var contextSwitches = ContextSwitches;

    if (context.hasVerb() && _.any(context.getVerb().contextSwitches)) {
      contextSwitches = _.defaultsDeep({}, context.getVerb().contextSwitches, contextSwitches);
    }

    var state = contextSwitches[currentState];
    if (state) {
      var sw = state[context.current()];
      if (sw) {
        context.setState(sw);
      }
    }
  }

  Director.prototype.isFiller = function(context) {
    var fillerWords = FillerWords[context.getState()];

    if (context.hasVerb()) {
      fillerWords = fillerWords
        ? fillerWords.concat(context.getVerb().fillerWords)
        : context.getVerb().fillerWords
    }

    return fillerWords 
      ? _.contains(fillerWords, context.current())
      : false;
  }

  Director.prototype.isDebug = function() {
    return this._debug;
  }

  Director.prototype.debug = function() {
    if (this.isDebug())
      console.log.apply(console, arguments);
  }
})();
