var login = "admin";
var email = "admin@changeme.com";
var first = "John";
var last = "Doe";
var password = "password";

console.log("Install script started. Loading configuration...");

if ("admin@changeme.com" == email) {
	console.log("Please edit this script (install.js) and update the variables at the top of the script to site specific values.");
	return;
}

// get config settings
var config = require('./config');

// instantiate user provider
var UserProvider = require('./providers/user').UserProvider;
var userProvider = new UserProvider(config.mongodb.host, config.mongodb.port, config.ldap.url, config.ldap.userSearch);

// instantiate itemtype provider
var ItemTypeProvider = require('./providers/itemtype').ItemTypeProvider;
var itemtypeProvider = new ItemTypeProvider(config.mongodb.host, config.mongodb.port);

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

console.log("Configuration load completed. Starting install script...");

createAdminUser(function(error) {
	if (error) console.log(error);
	
	createBonusType(function(error) {
		if (error) console.log(error);
		
		console.log("Congratulations! All config steps completed. Run 'node app.js' to start the application.");
	});
});

return;