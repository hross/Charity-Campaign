var config = require('../config');
var ADMIN_ROLE = config.roles.ADMIN_ROLE;

// instantiate user provider
var UserProvider = require('../providers/user').UserProvider;
var userProvider = new UserProvider(config.ldap.url, config.ldap.userSearch);

// instantiate itemtype provider
var ItemTypeProvider = require('../providers/itemtype').ItemTypeProvider;
var itemtypeProvider = new ItemTypeProvider();

module.exports = {
  
  	// /
  
  index: function(req, res){
    res.render();
  },
  
  	// /about
  
  about: function(req, res){
    res.render();
  },
  
  // render application admin options
  
  admin: function(req, res) {
  	var isAdmin = (req.session.user && req.session.user.roles &&
		req.session.user.roles.indexOf(ADMIN_ROLE)>=0);
		
	if (!isAdmin) {
		req.flash('error', "You are not an administrator.");
		res.redirect('back');
		return;
	}
	
	res.render(null, {locals: {isAdmin: isAdmin}});
  },
  
  install: function(req, res) {
  
  	//TODO: make a form for creating these
	var login = "admin";
	var email = "admin@admin.com";
	var first = "John";
	var last = "Doe";
	var password = "password";

  
	var createBonusType = function(callback) {
		console.log("Creating system bonus item type.");
		itemtypeProvider.findSystemBonus(function(error, itemtype) {
			if (!itemtype) {
				// add system bonus point type
				itemtypeProvider.save({
					name: "Bonus Points",
					description: "Default Bonus Point Value (added by the system)",
					points: 1,
					campaignId: "-1", // no campaign
					visible: false,
					system: true
				}, function (error, results) {
					console.log("Bonus type successfully created.");
					callback(error);
				});
			} else {
				console.log("Bonus type already created.");
				callback(null);
			}
		});
	};
	
	var createAdminUser = function(callback) {
		// create admin user
		userProvider.findByLogin(login, function(error, user) {
			 if (user) {
				console.log("Administrative user already created.");
				callback(null);
				return;
			} else {
				console.log("Creating admin user...");
				
				userProvider.save({
					login: login,
					password: password,
					password2: password,
					email: email,
					first: first,
					last: last
				}, function( error, users) {
					if (error) {
						console.log("Could not successfully create the admin account!");
						callback(error);
						return;
					}
		
					console.log("Successfully created account.");
					userProvider.addRoleByLogin(login, config.roles.ADMIN_ROLE, function(error, user) {
						if (error) { callback(error); return; }
						
						console.log("Successfully added admin role to account.");	
						callback(null);
					});
				});
			}
		});
	};
	
	console.log("Starting install script...");
	
	createAdminUser(function(error) {
		if (error) {
			console.log(error);
			req.flash('error', "Problem creating admin user in install script.");
			res.render(null, {locals: {isAdmin: isAdmin}});
			return;
		}
		
		createBonusType(function(error) {
			if (error) {
				console.log(error);
				req.flash('error', "Problem creating system bonus type.");
				res.render(null, {locals: {isAdmin: isAdmin}});
				return;
			}
			
			console.log("install completed.");
			res.render(null, null);
		});
	});

  },
  
	// generic find route function, called by the controller when it doesn't know what to do
  
  findGetRoute: function(action){
	 switch(action) {
      case 'about':
        return ['about', false];
      	break;
      case 'admin':
      	return ['admin', true];
      	break;
      case 'install':
      	return ['install', false];
      	break;
      default:
      	return null;
     }
  },
};
