var config = {};

config.mongodb = {};
config.ldap = {};
config.roles = {};

config.mongodb.host = 'localhost';
config.mongodb.port = 27017;

// ldap connection info for user accounts
config.ldap.url = 'ldap://localhost:10389';
config.ldap.userSearch = "uid=[login],ou=system";

// configure various roles for charity campaign (used by controllers for security)
config.roles.CAMPAIGN_ADMIN_ROLE = 'Campaign Administrator ';
config.roles.ADMIN_ROLE = "Administrator";
config.roles.TEAM_CAPTAIN_ROLE = "Team Captain ";

module.exports = config;
