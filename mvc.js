/**
 * Module dependencies.
 */

var fs = require('fs');
var express = require('express');

exports.boot = function(app){
  bootApplication(app);
  bootControllers(app);
};

// App settings and middleware

function bootApplication(app) {

	app.configure('development', function(){
		app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
	});
	
	app.configure('production', function(){
		console.log("Running in production mode...")
		app.use(function(err, req, res, next){
   			res.render('500');
 		});
	});

	app.use(express.logger(':method :url :status'));
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(express.cookieParser());
	app.use(express.session({ secret: 'keyboard cat' }));
	app.use(app.router);
	app.use(express.static(__dirname + '/public'));

	// Example 404 page via simple Connect middleware
	app.use(function(req, res){
		res.render('404', {locals: {url:'', luser: null}});
	});

	// Setup ejs views as default, with .html as the extension
	app.set('views', __dirname + '/views');
	app.register('.html', require('ejs'));
	app.set('view engine', 'html');
	
	// we always want a user object, campaign id and admin variable
	app.set('view options', {
		luser: null,
		campaignId: null,
		isAdmin: false,
		adminEmail: 'admin@yoursite.com' //TODO: make this a config setting
	});

  // Some dynamic view helpers
  app.dynamicHelpers({
    request: function(req){
      return req;
    },

    hasMessages: function(req){
      if (!req.session) return false;
      return Object.keys(req.session.flash || {}).length;
    },

    messages: function(req){
      return function(){
        var msgs = req.flash();
        return Object.keys(msgs).reduce(function(arr, type){
          return arr.concat(msgs[type]);
        }, []);
      }
    }
  });
   
  // end app init
}

// Bootstrap controllers

function bootControllers(app) {
  fs.readdir(__dirname + '/controllers', function(err, files){
    if (err) throw err;
    files.forEach(function(file){
      bootController(app, file);
    });
  });
}

// simple authentication support via sessions

function requiresLogin(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/users/validate?redir=' + req.url);
  }
};

// Example (simplistic) controller support

function bootController(app, file) {
  var name = file.replace('.js', '');
  var actions = require('./controllers/' + name);
  var ending = "s";
  if( name.substr(-1) === "s" ) { ending="es"; }
  var plural = name + ending;
  var prefix = '/' + plural; 

  // Special case for "app"
  if (name == 'app') prefix = '/';

  Object.keys(actions).map(function(action){
  	var isJson = actions.findJsonRoute && actions.findJsonRoute(action);

    var fn = controllerAction(name, plural, action, isJson, actions[action]);
    switch(action) {
      case 'index':
        app.get(prefix, fn);
        app.get(prefix + '/filter/:parentId', fn);
        break;
      case 'show':
      	app.get(prefix + '/show/:id/*', fn);
        app.get(prefix + '/show/:id.:format?', fn);
        break;
      case 'add':
        app.get(prefix + '/add', requiresLogin, fn);
        app.get(prefix + '/add/:parentId', requiresLogin, fn);
        break;
      case 'create':
        app.post(prefix + '/create', requiresLogin, fn);
        break;
      case 'edit':
        app.get(prefix + '/edit/:id', requiresLogin, fn);
        break;
      case 'update':
        app.post(prefix + '/update/:id', requiresLogin, fn);
        break;
      case 'validate':
      	app.get(prefix + '/validate', fn);
        app.post(prefix + '/validate', fn);
        break;
      case 'invalidate':
      	app.get(prefix + '/invalidate', fn);
        app.post(prefix + '/invalidate', fn);
        break;
      case 'destroy':
        app.get(prefix + '/destroy/:id', requiresLogin, fn);
        break;
      case 'findGetRoute':
      	// find route function is used to resolve unknown paths
      	break;
      case 'findPostRoute':
      	// find route function is used to resolve unknown paths
      	break;
      case 'findJsonRoute':
      	// find route function is used to resolve unknown paths
      	break;
      case 'resolveSecurity':
      	// TODO: stub for a security function
      	break;
      default:
      	// a function we don't know how to describe with the controller
      	// use a generic findRoute function to tell us the path if it exists
      	if (actions.findGetRoute && actions.findGetRoute(action)) {
      		if (actions.findGetRoute(action)[1]) {
      			// call with login
      			app.get(prefix + actions.findGetRoute(action)[0], requiresLogin, fn);
      		} else {
      			// call without login
      			app.get(prefix + actions.findGetRoute(action)[0], fn);
      		}
      	}
      	
      	if (actions.findPostRoute && actions.findPostRoute(action)) {
      		if (actions.findPostRoute(action)[1]) {
      			// call with login
      			app.post(prefix + actions.findPostRoute(action)[0], requiresLogin, fn);
      		} else {
      			// call without login
      			app.post(prefix + actions.findPostRoute(action)[0], fn);
      		}
      	}
      	
      	if (isJson) {
      		if (actions.findJsonRoute(action)[1]) {
      			// call with login
      			app.get(prefix + actions.findJsonRoute(action)[0], requiresLogin, fn);
      		} else {
      			// call without login
      			app.get(prefix + actions.findJsonRoute(action)[0], fn);
      		}
      	}
      	break;
    }
  });
}

// Proxy res.render() to add some magic

function controllerAction(name, plural, action, isJson, fn) {
  return function(req, res, next){
    var render = res.render;
    var format = req.params.format;
    var path = __dirname + '/views/' + name + '/' + action + '.html';
    
    res.render = function(obj, options, fn){
      res.render = render;
      // Template path
      if (typeof obj === 'string') {
        return res.render(obj, options, fn);
      }

      // Format support
     if (isJson) {
     	format = 'json';
     }	
     
      if (format) {
        if (format === 'json') {
          return res.send(obj);
        } else {
          throw new Error('unsupported format "' + format + '"');
        }
      }

      // Render template
      res.render = render;
      
      // make sure options is an array
      options = options || {};
      
      // check for user and if they exist
      // add a local for all views
      if (req.session.user) {
      	options['luser'] = req.session.user;
      }
      
      // Expose obj as the "users" or "user" local
      if (action == 'index') {
        options[plural] = obj;
      } else {
        options[name] = obj;
      }
      
      // always add current url to options
      options['url'] = req.url;
      
      return res.render(path, options, fn);
    };
    fn.apply(this, arguments);
  };
}
