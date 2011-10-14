var url = require('url');

var config = {};

config.mongodb = {};
config.ldap = {};
config.roles = {};

if (process.env.MONGOHQ_URL) {
	var info = url.parse(process.env.MONGOHQ_URL);
	config.mongodb.dbname = info.pathname.replace("/", "");
	config.mongodb.host = info.host;
	config.mongodb.port = info.port;
	if (info.auth) {
		try {
			config.mongodb.user = info.auth.split(":")[0];
			config.mongodb.pass = info.auth.split(":")[1];
		} catch (err) {
			console.log("Error parsing auth info.");
		}
	}
} else if (process.env.MONGO_URL) {
	var info = url.parse(process.env.MONGO_URL);
	config.mongodb.dbname = info.pathname.replace("/", "");
	config.mongodb.host = info.host;
	config.mongodb.port = info.port;
	if (info.auth) {
		try {
			config.mongodb.user = info.auth.split(":")[0];
			config.mongodb.pass = info.auth.split(":")[1];
		} catch (err) {
			console.log("Error parsing auth info.");
		}
	}
} else {
	config.mongodb.dbname = 'charity-campaign';
	config.mongodb.host = 'localhost';
	config.mongodb.port = 27017;
}

// ldap connection info for user accounts
config.ldap.enable = false;
config.ldap.url = 'ldap://localhost:10389';
config.ldap.userSearch = "uid=[login],ou=system";

// configure various roles for charity campaign (used by controllers for security)
config.roles.CAMPAIGN_ADMIN_ROLE = 'Campaign Administrator ';
config.roles.ADMIN_ROLE = "Administrator";
config.roles.TEAM_CAPTAIN_ROLE = "Team Captain ";

module.exports = config;
