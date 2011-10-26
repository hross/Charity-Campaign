var config = require('../config'); // config info

var ldap = null;
if (config.ldap.enable) {
	 ldap = require('ldapjs');
}

DirectoryProvider = function() {
}

DirectoryProvider.prototype.importUsers = function(userHandler, callback) {
	if (!config.ldap.enable) { 
		console.log("LDAP not enabled!");
		callback(); 
		return;
	}

	// connect to LDAP
	var client = ldap.createClient({
		url: config.ldap.url
	});
					
	client.bind(config.ldap.directory.user, config.ldap.directory.password, function(error) {
		// invalid login
		if (error && (error.code == 49)) { 
			console.log("Invalid login.");
			callback(error); 
			return; 
		}
	
		// some other kind of error
		if (error) { 
			console.log("Problem with LDAP config.");
			console.log(error);
			callback(error); 
			return; 
		}
		
		console.log("Successfully bound to directory. Searching for users...");
		
		var opts = {
		  attributes: ['uid', 'displayName', 'cn'], 
		  filter: config.ldap.directory.search,
		  scope: 'sub'
		};
		
		client.search(config.ldap.directory.base, opts, function(error, res) {
		  if (error) { callback(error); return; }
		
		  res.on('searchEntry', function(entry) {
			userHandler(entry.object);
		  });
		  
		  /*res.on('searchReference', function(referral) {
			console.log('referral: ' + referral.uris.join());
		  });
		  
		  res.on('error', function(err) {
			console.error('error: ' + err.message);
		  });*/
		  
		  res.on('end', function(result) {
			// success
			callback(null, result);
		  });
		});
	});
}

exports.DirectoryProvider = DirectoryProvider;