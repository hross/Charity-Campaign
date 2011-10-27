var config = require('./config'); // config info

var async = require('async');

var DirectoryProvider = require('./providers/directory').DirectoryProvider;
var directoryProvider = new DirectoryProvider();

var UserProvider = require('./providers/user').UserProvider;
var userProvider = new UserProvider(config.ldap.url, config.ldap.userSearch);

var entries = []; // store all ldap entries
var created = 0;


var createUser = function(login, password, account, email, first, last, callback) {
	// create admin user
	userProvider.findByLogin(login, function(error, user) {
		 if (user) {
			console.log("User " + login + " already created.");
			callback(null, user);
			return;
		} else {
			console.log("Creating account: " + login + "...");
			
			userProvider.save({
				login: login,
				password: password,
				password2: password,
				email: email,
				first: first,
				last: last,
				account: account
			}, function( error, users) {
				if (error) {
					console.log("Failed to create account: " + login);
					callback(error);
					return;
				}
	
				console.log("Success!");
				callback(null, users[0]);
			});
		}
	});
};

var userHandler = function(entry) {
	entries.push(entry);
};

var userCreator = function(entry, callback) {
	console.log('entry: ' + JSON.stringify(entry));
	
	createUser(entry.uid, "password", entry.uid, entry.mail, entry.firstName, entry.lastName, function(error, result) {
		if (!error && result) {
			created++;
		}
		
		callback(error, result);
	});
};



console.log("Starting user import...");

directoryProvider.importUsers(['uid', 'displayName', 'cn'], userHandler, function(error, result) {
	if (0 != result.status) { console.log("LDAP query issue with status code: " + result.status); }
	
	if (error) {
		console.log("Something bad happened. The error was: ");
		console.log(error);
	}
	
	async.map(entries, userCreator, function(error, results) {
		console.log(created + " users created.");
	
		process.exit();
	});
});
