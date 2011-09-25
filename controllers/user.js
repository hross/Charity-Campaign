var config = require('../config');

// instantiate user provider
var UserProvider = require('../providers/user').UserProvider;
var userProvider = new UserProvider(config.mongodb.host, config.mongodb.port, config.ldap.url, config.ldap.userSearch);

// instantiate user provider
var ItemProvider = require('../providers/item').ItemProvider;
var itemProvider = new ItemProvider(config.mongodb.host, config.mongodb.port);

// instantiate team provider
var TeamProvider = require('../providers/team').TeamProvider;
var teamProvider = new TeamProvider(config.mongodb.host, config.mongodb.port);

var ADMIN_ROLE = config.roles.ADMIN_ROLE;

module.exports = {
  
  // list
  
  index: function(req, res){
	var isAdmin = (req.session.user && req.session.user.roles &&
		req.session.user.roles.indexOf(ADMIN_ROLE)>=0);
		
	var campaignId = req.params.parentId;
  
  	if (campaignId) {
		userProvider.findByCampaign(campaignId, function(error, users) {
			res.render(null, {locals: {users: users, isAdmin: isAdmin, campaignId: campaignId}});
		});
    } else {
    	userProvider.findAll(function(error, users) {
			res.render(null, {locals: {users: users, isAdmin: isAdmin, campaignId: campaignId}});
		});

    }
  },

  // single display
  
  show: function(req, res, next){
  
    userProvider.findById(req.params.id, function(error, user) {
    	if (error) return next(error);
    	
    	if (!user) {
    		req.flash('error', 'Unable to find user.');
    		res.redirect('back');
    	}
    	
    	itemProvider.findByUser(user.id, null, function(error, items) {
    		if (error) next(error);
    		
    		if (!items) items = [];
    		
    		var isAdmin = (req.session.user && req.session.user.roles && 
				(req.session.user.roles.indexOf(ADMIN_ROLE)>=0));
				
			if (!user.teams) user.teams = [];
			
			teamProvider.findAllById(user.teams, function(error, teams) {
    		
    			res.render(null, {locals: {user: user, items: items, teams: teams, isAdmin: isAdmin}});
    		});
    	});
    });
  },
  
  // edit screen
  
  edit: function(req, res, next){
  	var isAdmin = (req.session.user && req.session.user.roles &&
		req.session.user.roles.indexOf(ADMIN_ROLE)>=0);

  	if (!isAdmin) {
		req.flash('error', "You are not an administrator.");
		res.redirect('back');
		return;
	}
  
	userProvider.findById(req.params.id, function(error, user) {
		if (error) return next(error);
		
		var adminRole = user.roles && (user.roles.indexOf(ADMIN_ROLE) >= 0);
		
        res.render(null, {locals: {user: user, isAdmin: isAdmin, adminRole: adminRole}});
    });
  },
  
  // display upload user list form
  csv: function(req, res, next){
  	var isAdmin = (req.session.user && req.session.user.roles &&
		req.session.user.roles.indexOf(ADMIN_ROLE)>=0);
	
	if (!isAdmin) {
		req.flash('error', "You are not an administrator.");
		res.redirect('back');
		return;
	}
		
	res.render(null, {locals: {isAdmin: isAdmin}});
  },
  
  // upload a list of users as a CSV
  upload: function(req, res, next){
  
  	console.log("Starting upload...");
  
	var isAdmin = (req.session.user && req.session.user.roles &&
		req.session.user.roles.indexOf(ADMIN_ROLE)>=0);
	
	if (!isAdmin) {
		req.flash('error', "You are not an administrator.");
		res.redirect('back');
		return;
	}

	req.form.complete(function(error, fields, files){
    	if (error) { next(error); return; }
    	
    	if (files.userList) {
      		console.log('Uploaded %s to %s', files.userList.filename, files.userList.path);
      		
    		// import the csv file of users if it exists
    		userProvider.importCsv(files.userList.path, function(error, users) {
    			var accounts = "";
    			if (error) { next(error); return; }
    			
    			if (!users) {
					req.flash('info', 'No user accounts were created.');
					res.redirect('back');
					return;
    			} else {
    				if (typeof(users.length)=="undefined") users = [users];

					for (var i = 0; i < users.length; i++) {
						console.log("Created user: " + users[i].login);
						if (i != 0) accounts += ", ";
						accounts += users[i].login;
					}
					
    				req.flash('info', 'Successfully created these accounts: ' + accounts);
      				res.redirect('back');
      				return;
    			}
    		});
    	} else {
    		req.flash('info', "Could not create any user accounts.");
      		res.redirect('back');
    	}
  	});
  },


  
  // create screen
  
  add: function(req, res, next){
  	var isAdmin = (req.session.user && req.session.user.roles &&
		req.session.user.roles.indexOf(ADMIN_ROLE)>=0);
	res.render(null, {locals: {isAdmin: isAdmin}});
  },
  
  // handle create post
  create: function(req, res, next){

	if (!req.session.user || !req.session.user.roles || 
			!(req.session.user.roles.indexOf(ADMIN_ROLE)>=0)) {
		req.flash('error', "You are not an administrator.");
		res.redirect('back');
		return;
	}
 
    // check passwords
  	var password = req.param('password');
  	var password2 = req.param('password2');
  	var account = req.param('account');
  	
  	if (!account) {
		if (password && (password.length > 0)) {
			if (password != password2) {
				req.flash('error', 'Passwords did not match!');
				res.redirect('back');
				return;
			}
		} else {
			req.flash('error', 'Password was empty!');
			res.redirect('back');
			return;
		}
  	}
  
  	var login = req.param('login');
  
  	userProvider.findByLogin(login, function(error, user) {
  		if (user) {
  			req.flash('error', 'This user already exists. Please choose a different login.');
  			res.redirect('back');
  			return;
  		}
  		
  		var isAdmin = req.param('isadmin') && (req.param('isadmin') == 'on');
  		
		userProvider.save({
			login: login,
			password: req.param('password'),
			password2: req.param('password2'),
			email: req.param('email'),
			first: req.param('first'),
			last: req.param('last'),
			account: account
		}, function( error, users) {
			if (error) return next(error);
			
			if (isAdmin) {
				userProvider.addRoleByLogin(login, ADMIN_ROLE, function(error, callback) {
					req.flash('info', 'Successfully created account _' + login + '_');
					res.redirect('/users/show/' + users[0].id);
				});
			} else {
				req.flash('info', 'Successfully created account _' + login + '_');
				res.redirect('/users/show/' + users[0].id);
			}
		});
  	});

  },
  
  // update an item
  
  update: function(req, res, next){
  
  	if (!req.session.user || !req.session.user.roles || 
			!(req.session.user.roles.indexOf(ADMIN_ROLE)>=0)) {
		req.flash('error', "You are not an administrator.");
		res.redirect('back');
		return;
	}
  
  	// check passwords
  	var password = req.param('password');
  	var password2 = req.param('password2');
  	var account = req.param('account');
  	
  	if (!account) {
		if (password && (password.length > 0)) {
			if (password != password2) {
				req.flash('error', 'Passwords did not match!');
				res.redirect('back');
				return;
			}
		}
  	}
  
  	var login = req.param('login');
  
  	userProvider.findByLogin(login, function(error, user) {
  		/*if (user) {
  			req.flash('error', 'This user already exists. Please choose a different login.');
  			res.redirect('back');
  			return;
  		}*/
  		
  		var isadmin = req.param('isadmin') && (req.param('isadmin') == 'on');
  		
		userProvider.update({
			login: login,
			password: req.param('password'),
			email: req.param('email'),
			first: req.param('first'),
			last: req.param('last'),
			account: account,
			id: req.params.id
		}, function( error, users) {
			if (error) return next(error);
			
			if (isadmin) {
				userProvider.addRoleByLogin(login, ADMIN_ROLE, function(error, callback) {
					req.flash('info', 'Successfully updated account _' + login + '_');
					res.redirect('/users/show/' + users[0].id);
				});
			} else {
				userProvider.removeRole(req.params.id, ADMIN_ROLE, function(error, callback) {
					req.flash('info', 'Successfully updated account _' + login + '_');
					res.redirect('/users/show/' + users[0].id);
				});
			}
		});
  	});
  },
  
  // add a role
  
  addrole: function(req, res, next){

	if (!req.session.user || !req.session.user.roles || 
			!(req.session.user.roles.indexOf(ADMIN_ROLE)>=0)) {
		req.flash('error', "You are not an administrator.");
		res.redirect('back');
		return;
	}

  	var user = req.session.user;
  	var role = req.param('role');
  	
  	if ((!user) || !role || !role.substring) {
  		req.flash('error', "Unable to add role to this user.");
  		res.redirect('back');
  		return;
  	}
  
  	// add this role if there is a user
	userProvider.addRole(user, role, function(error, user) {
    	if (error) return next(error);
		
		req.session.user = user;
		req.flash('info', 'Successfully added role: _' + role +'_.');
		res.redirect('back');
    });
  },
  
  // join a team
  
  join: function(req, res, next){
  	var user = req.session.user;
  	var teamId = req.param('teamId');
  	
  	if ((!user) || (teamId <= 0)) {
  		req.flash('error', "Unable to join team.");
  		res.redirect('back');
  		return;
  	}

	teamProvider.findById(teamId, function(error, team) {
    	if (error) return next(error);
    	
    	if (!team) {
    		req.flash('error', 'Cannot find this team.');
    		res.redirect('back');
    		return;
    	}
  
		// join the team if there is a user
		userProvider.joinTeam(user, team, function( error, user) {
			if (error) return next(error);
			
			if (!user) {
				req.flash('error', 'Could not join the team.');
				res.redirect('back');
				return;
			}
			
			req.session.user = user;
			req.flash('info', 'Successfully joined the team.');
			res.redirect('back');
		});
    });
  },
  
  // leave a team
  
  leave: function(req, res, next){
  	var user = req.session.user;
  	var teamId = req.param('teamId');
  	
  	if ((!user) || (teamId <= 0)) {
  		req.flash('error', "Unable to leave team.");
  		res.redirect('back');
  		return;
  	}
  	
  	teamProvider.findById(teamId, function(error, team) {
    	if (error) return next(error);
    	
    	if (!team) {
    		req.flash('error', 'Cannot find this team.');
    		res.redirect('back');
    		return;
    	}
    	
    	// leave the team if there is a user
		userProvider.leaveTeam(user, team, function(error, user) {
			if (error) return next(error);
			
			if (!user) {
				req.flash('error', 'Could not leave the team.');
				res.redirect('back');
				return;
			}
	
			req.session.user = user;
			req.flash('info', 'Successfully left the team.');
			res.redirect('back');
		});
    });
  },
  
  // view members
  
  name: function(req, res){
  	var login = req.param('login');
  	
  	if (!login) {
  		return next("Unable to retrieve member profile.");
  	}
  	
	userProvider.findByLogin(login, function(error, user) {
        if (error) return next(error);
    	
    	if (!user) {
    		req.flash('error', 'Unable to find user.');
    		res.redirect('back');
    	} else {
    		res.redirect('/users/show/' + user.id + '/' + user.slug);
    	}
    });
  },
  
  // validate (authenticate) a user
  
  validate: function(req, res, next){

  	// check for a login and password post
  	var login = req.param('login');
  	var password = req.param('password');

  	var redir = req.query.redir;
  	if (!redir) {
  		redir = req.param('redir');
  		if (!redir) {
  			redir = "/";
  		}
  	}
  	
  	// attempt to validate
  	if (login && password) {
  		userProvider.authenticateLdap(login, password, function(error, user) {
  			if (error) return next(error);
  		
			if (user) {
			  req.session.user = user; // log the user in
			  console.log("redirect: " + redir);
			  res.redirect(redir); // redirect to previous url or base
			} else {
			  // re-render the login page
			  req.flash('warn', 'Login failed');
			  res.render(null, {redir: redir});
			}
	  	});
  	} else {
  		// show the login page
  		res.render(null, {redir: redir});
  	}
  },
  
  // invalidate (logout) a user
  
  invalidate: function(req, res, next) {
  	var user = req.session.user;
  	delete req.session.user;
  	req.flash('info', 'You have been logged out.');
  	res.redirect('back');
  },
  
  // destroy the user
  
  destroy: function(req, res, next){

	if (!req.session.user || !req.session.user.roles || 
			!(req.session.user.roles.indexOf(ADMIN_ROLE)>=0)) {
		req.flash('error', "You are not an administrator.");
		res.redirect('back');
		return;
	}
  
	userProvider.findById(req.params.id, function(error, user) {
		if (error) return next(error);
		
		userProvider.remove(req.params.id, function(error, id) {
			if (error) return next(error);
			
			req.flash('info', 'Successfully deleted _' + user.login + '_.');
			res.redirect('/users');
    	});
    });
  },
  
  // output json list of users for filtering
  
  json: function(req, res, next) {
  	var searchterm = "";
  	var limit = 0;
  	
  	if (req.param('limit')) {
  		limit = parseInt(req.param('limit'));
    	if (isNaN(limit)) limit = 0;
  	}
  	
  	if (req.param('search')) {
  		searchterm = req.param('search');
  	}
  	
  	userProvider.searchLogin(searchterm, limit, function(error, users) {
  		if (error) {
  			res.send(null);
  			return;
  		}
  		
  		if (!users || users.length == 0) {
  			return {results: []};
  		}

  		var results = [];
  		
  		for (var i = 0; i < users.length; i++) {
  			results.push({title: users[i].login});
  		}
  		
  		res.send({results: results});
  	});
  },
  
  // generic find route function, called by the controller when it doesn't know what to do
  
  findGetRoute: function (action){
	 switch(action) {
      case 'join':
        return ['/join/:teamId', true];
      	break;
      case 'leave':
        return ['/leave/:teamId', true];
      	break;
      case 'name':
        return ['/name/:login', false];
      	break;
      case 'csv':
      	return ['/csv', true];
      default:
      	return null;
     }
  },
  
  findJsonRoute: function (action) {
  	switch(action) {
      case 'json':
        return ['/json', false];
      	break;
      default:
      	return null;
      }
  },
  
    // generic find route function, called by the controller when it doesn't know what to do
  
  findPostRoute: function (action){
	 switch(action) {
      case 'addrole':
      	return ['/addrole', true];
      	break;
      case 'upload':
      	return ['/upload', true];
      	break;
      default:
      	return null;
     }
  },  
};
