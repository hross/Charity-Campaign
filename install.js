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
var config = require('config');

// instantiate user provider
var UserProvider = require('providers/user').UserProvider;
var userProvider = new UserProvider(config.mongodb.host, config.mongodb.port, config.ldap.url, config.ldap.userSearch);

console.log("Configuration load completed. Starting install script...");

// create admin user
userProvider.findByLogin(login, function(error, user) {
	if (user) {
		console.log("Administrative user already created. Exiting...");
		return;
	}

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
				console.log(error);
				return;
			}

			console.log("Successfully created account.");

			userProvider.addRoleByLogin(login, ADMIN_ROLE, function(error, callback) {
				console.log("Successfully added admin role to account.");
				console.log("Congratulations! All config steps completed. Run 'node app.js' to start the application.");
			});
	});
});