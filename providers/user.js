/* TODO: recursive remove bonuses, etc on user remove */

require('../lib/util.js'); // misc utility functions

var config = require('../config'); // config info

var crypto = require('crypto');

var Db = require('mongodb').Db;
var Connection = require('mongodb').Connection;
var Server = require('mongodb').Server;
var BSON = require('mongodb').BSON;
var ObjectID = require('mongodb').ObjectID;

var ldap = null;
if (config.ldap.enable) {
	 ldap = require('ldapjs');
}

var slugify = require('../lib/slugify'); // custom slug tools
var parse = require('../lib/parsecsv'); // csv parsing

var async = require('async');

UserProvider = function(ldapUrl, userSearch) {
  this.ldapUrl = ldapUrl;
  this.userSearch = userSearch;
  
  /*console.log("connecting to DB with credentials: ");
  console.log("db: " + config.mongodb.dbname);
  console.log("host: " + config.mongodb.host);
  console.log("port: " + config.mongodb.port);
  console.log("user: " + config.mongodb.user);
  console.log("pass: " + config.mongodb.pass);*/
  
  this.db = new Db(config.mongodb.dbname, new Server(config.mongodb.host, config.mongodb.port, {auto_reconnect: true}, {}));
  
  var db = this.db;
  this.db.open(function(error, client){
  	if (typeof config.mongodb.user !== 'string' || typeof config.mongodb.pass !== 'string') return;
  	
  	console.log("connection open. authenticating...");
  	db.authenticate(config.mongodb.user, config.mongodb.pass, function(error) {
  		if (error) console.log(error);
  		
  		console.log("auth complete!");
  	});
  });
};

UserProvider.prototype.getNextUserId = function(callback) {
	this.getCounterCollection(function(error, counters) {
		if( error ) callback(error)
      	else {
			counters.findAndModify({_id: "userId"}, [], {$inc: {c: 1}}, {}, function(error, object) {
				if (object) {
					callback(null, object.c + ''); // convert number to string
				} else {
					counters.insert({_id: "userId", c: 1}, function(error, docs) {
						callback(null, 0 + ''); //convert number to string
					});
				}
			});
      	}
    });
};

UserProvider.prototype.getCounterCollection= function(callback) {
  this.db.collection('counters', function(error, counter_collection) {
    if( error ) callback(error);
    else callback(null, counter_collection);
  });
};

UserProvider.prototype.getCollection= function(callback) {
  this.db.collection('users', function(error, user_collection) {
    if (error) { callback(error); return; }
    
    callback(null, user_collection);
  });
};

UserProvider.prototype.findAll = function(callback) {
    this.getCollection(function(error, user_collection) {
      if( error ) callback(error)
      else {
        user_collection.find().sort('login').toArray(function(error, results) {
			if (error) { callback(error); return; }
          
        	callback(null, results);
        });
      }
    });
};

UserProvider.prototype.findByCampaign = function(campaignId, callback) {
    this.getCollection(function(error, user_collection) {
		if (error) { callback(error); return; }
      
		user_collection.find({campaigns: campaignId}).toArray(function(error, results) {
			if (error) { callback(error); return; }
			
			callback(null, results);
		});
    });
};


UserProvider.prototype.findById = function(id, callback) {
    this.getCollection(function(error, user_collection) {
		if (error) {
      		callback(error);
      	} else {
        	//user_collection.db.bson_serializer.ObjectID.createFromHexString(id)
        	user_collection.findOne({id: id}, function(error, result) {
				if (error) {
					console.log(error);
					callback(error);
				}
				callback(null, result);
			});
		}
    });
};

UserProvider.prototype.findByLogin = function(login, callback) {
    this.getCollection(function(error, user_collection) {
		if (error) { callback(error); return; }

		user_collection.findOne({login: login}, function(error, result) {
			if (error) { callback(error); return; }
			
			callback(null, result);
		});
    });
};

UserProvider.prototype.findByTeam = function(teamId, callback) {
    this.getCollection(function(error, user_collection) {
      	if (error) callback(error);
      
		user_collection.find({teams: teamId}, {sort: [['login','asc']]}).toArray(function(error, users) {
		  if (error) { callback(error); return; }
		  
		  callback(null, users);
		});
    });
};

UserProvider.prototype.searchLogin = function(term, limit, callback) {
    this.getCollection(function(error, user_collection) {
		if (error) {
      		callback(error)
      	} else {
        	//user_collection.db.bson_serializer.ObjectID.createFromHexString(id)
        	user_collection.find({login: { $regex : term + '.*', $options: 'i' }}, {limit: limit, sort: [['login','asc']]}).toArray(function(error, result) {
				if (error) {
					console.log(error);
					callback(error);
				}
				callback(null, result);
			});
		}
    });
};

UserProvider.prototype.authenticateLdap = function(login, password, callback) {
	var provider = this;
	
    this.getCollection(function(error, user_collection) {
		if (error) {
			// something bad happened so get out
      		callback(null);
      	} else {
        	//user_collection.db.bson_serializer.ObjectID.createFromHexString(id)
        	user_collection.findOne({login: login}, function(error, result) {
				if (error) {
					console.log(error);
					callback(null);
				}
				
				if (!result) {
					// login not found
					callback(null);
					return;
				}
				
				if (!result.account) {
					// this is not an LDAP account
					var passwordHash = crypto.createHash('md5').update(password).digest("hex");
					if (result.password == passwordHash) {
						// password match
						callback(null, result);
						return;
					} else {
						// password didn't match
						callback(null, null);
						return;
					}
				}

				if (config.ldap.enable) {
					// connect to LDAP
					var client = ldap.createClient({
						url: provider.ldapUrl
					});
					
					var searchString = provider.userSearch.replace("[login]", result.account);
					client.bind(searchString, password, function(error) {
						// invalid login
						if (error && (error.code == 49)) { callback(null, null); return; }
					
						// some other kind of error
						if (error) { 
							console.log("Problem with LDAP config.");
							console.log(error);
							callback(null, null); 
							return; 
						}
						
						// success
						callback(null, result);
					});
				} else {
					console.log("LDAP was not enabled.");
					callback(null, null); 
					return; 
				}
			});
		}
    });
};

UserProvider.prototype.authenticate = function(login, password, callback) {
    this.getCollection(function(error, user_collection) {
		if (error) {
			// something bad happened so get out
      		callback(null);
      	} else {
        	//user_collection.db.bson_serializer.ObjectID.createFromHexString(id)
        	user_collection.findOne({login: login}, function(error, result) {
				if (error) {
					console.log(error);
					callback(null);
				}
				
				if (!result) {
					// login not found
					callback(null);
				}
				
				if (result.password == password) {
					// password match
					callback(result);
				} else {
					// password didn't match
					callback(null);
				}
			});
		}
    });
};

/*
UserProvider.prototype.findByLogin = function(login, callback) {
    this.getCollection(function(error, user_collection) {
		if (error) {
      		callback(error)
      	} else {
        	//user_collection.db.bson_serializer.ObjectID.createFromHexString(id)
        	user_collection.findOne({login: login}, function(error, result) {
				if (error) {
					console.log(error);
					callback(error);
				}
				callback(null, result);
			});
		}
    });
};*/

UserProvider.prototype.save = function(users, callback) {
	var provider = this;
    this.getCollection(function(error, user_collection) {
    	if (error) { callback(error); return; }

		if (typeof(users.length)=="undefined") users = [users];

		var createUser = function(user, callback) {
		
			provider.findByLogin(user.login, function(error, found_user) {
		
				// ensure no errors and user does not already exist
				if (error) { callback(error); return; }
				if (found_user) { callback(null, null); return; }
				
				console.log("creating user...");
			
				user.created_at = new Date();
				user.update_on = new Date();
				
				provider.getNextUserId(function(error,id) {
					user.gravatar = crypto.createHash('md5').update(user.email).digest("hex");
					user.id = id;
					user.slug = slugify.slugify(user.login);
					
					user.password = crypto.createHash('md5').update(user.password).digest("hex");
					
					user_collection.insert(user, function() {
						console.log("created.");
						callback(null, user);
					});
				});
			});
		};
		  
		async.map(users, createUser, function(error, results) {
			if (error) callback(error);
			
			// after everything is done we are happy
			callback(null, results);
		});
    });
};

UserProvider.prototype.importCsv = function(fileName, callback) {
	var provider = this;

	// try to parse the csv file and return some user records
	parse.parseCsvFile(fileName, function(error, records) {
		if (error) { callback(error); return; }
		
		provider.getCollection(function(error, user_collection) {
			if (error) { callback(error); return; }
			if (!records) { callback(null, null); return; }
			
			var createUser = function(record) {
				console.log("Creating from CSV record...");
				console.log(record);
				
				if (!record.team) {
					record.teams = [];
				} else {
					record.teams = [record.team];
				}

				if (!record.campaign) {
					record.campaigns = [];
				} else {
					record.campaigns = [record.campaign];
				}
				
				if (record.login && record.password && record.email && record.first && record.last) {
					record.password = crypto.createHash('md5').update(record.password).digest("hex");
				
					// create the user from the record
					provider.save({
						login: record.login,
						password: record.password,
						password2: record.password,
						email: record.email,
						first: record.first,
						last: record.last,
						account: record.account,
						teams: record.teams,
						campaigns: record.campaigns
					}, function(error, users) {
						if (error) return callback(error, null);
						
						callback(null, users[0]);
						return;
					});
				} else {
					console.log("Could not create from CSV record...");
					console.log(record);
					callback(null, null);
					return;
				}
			};
			
			async.map(records, createUser, function(error, users){
    			callback(error, users);
			});
			
    	}); // end get collection
    }); // end parseCsvFile
};

UserProvider.prototype.joinTeamByLogin = function(login, team, callback) {
	if (!login) { callback(null); return; }

	var provider = this;
	provider.findByLogin(login, function(error, user) {
		if (error) { callback(error); return; }
		
		provider.joinTeam(user, team, function(error, user) {
			if (error) { callback(error); return; }
			
			callback(null, user);
		});
	});
};

UserProvider.prototype.leaveTeamByLogin = function(login, team, callback) {
	if (!login) { callback(null); return; }
	var provider = this;
	provider.findByLogin(login, function(error, user) {
		provider.leaveTeam(user, team, function(error, user) {
			if (error) { callback(error); return; }
			
			callback(null, user);
		});
	});
};

UserProvider.prototype.leaveTeam = function(user, team, callback) {
	var provider = this;
	provider.leaveTeamById(user, team.id, function(error, user) {
		if (error) { callback(error); return; }
		//TODO: can't remove from campaign if they are on multiple teams
		/*provider.leaveCampaign(user, team.campaignId, function(error, user) {
			callback(error, user);
		});*/
		callback(error, user);
	});
};

UserProvider.prototype.joinTeam = function(user, team, callback) {
	var provider = this;
	
	provider.joinTeamById(user, team.id, function(error, user) {
		if (error) { callback(error); return; }
		
		provider.joinCampaign(user, team.campaignId, function(error, user) {
			callback(error, user);
		});
	});
};

UserProvider.prototype.joinTeamById = function(user, teamId, callback) {
	this.getCollection(function(error, user_collection) {
      if (error) {
      	callback(error);
      	return;
      }

	  if ((!user) || (!user.id)) {
	  	 callback(error);
	  	 return;
	  }
	  
	  // find the user account to update
	  user_collection.findOne({id: user.id}, function(error, result) {
			if (error) {
				callback(error);
			}
			
			if (!result) {
				// id not found
				callback(null);
			}
			
			// build a list of parents with the new id
			var teams = result.teams;
			
			if (!teams || (teams.indexOf(teamId) < 0)) {
				// if this isn't already a parent, add it
				if (!teams) teams = [];
				teams.push(teamId);

				user_collection.update({id: user.id}, {$set: {teams: teams}}, {}, function(error) {
					if (error) { callback(error); return; }
					
					console.log("updated.");
					result.teams = teams;
					callback(null, result);
				});
			} else {
				callback(null, result);
			}
	  });
	}); 
};

UserProvider.prototype.leaveTeamById = function(user, teamId, callback) {
	this.getCollection(function(error, user_collection) {
      if (error) {
      	callback(error);
      	return;
      }

	  if ((!user) || (!user.id)) {
	  	 callback(error);
	  	 return;
	  }
	  
	  // find the user account to update
	  user_collection.findOne({id: user.id}, function(error, result) {
			if (error) {
				callback(error);
			}
			
			if (!result) {
				// id not found
				callback(null);
			}
			
			// build a list of parents with the new id
			var teams = result.teams;
			if (teams && (teams.indexOf(teamId) >= 0)) {
				// remove the team id
				teams.remove(teams.indexOf(teamId))
				user_collection.update({id: user.id}, {$set: {teams: teams}}, {}, function(error) {
					if (error) { callback(error); return; }

					result.teams = teams;
					callback(null, result);
				});
			} else {
				callback(null, result);
			}
	  });
	}); 
};

UserProvider.prototype.joinCampaign = function(user, campaignId, callback) {
	this.getCollection(function(error, user_collection) {
      if (error) {
      	callback(error);
      	return;
      }

	  if ((!user) || (!user.id)) {
	  	 callback(error);
	  	 return;
	  }
	  
	  // find the user account to update
	  user_collection.findOne({id: user.id}, function(error, result) {
			if (error) {
				callback(error);
			}
			
			if (!result) {
				// id not found
				callback(null);
			}
			
			// build a list of parents with the new id
			var campaigns = result.campaigns;
			
			if (!campaigns || (campaigns.indexOf(campaignId) < 0)) {
				// if this isn't already a parent, add it
				if (!campaigns) campaigns = [];
				campaigns.push(campaignId);

				user_collection.update({id: user.id}, {$set: {campaigns: campaigns}}, {}, function(error) {
					if (error) { callback(error); return; }
					
					console.log("updated.");
					result.campaigns = campaigns;
					callback(null, result);
				});
			} else {
				callback(null, result);
			}
	  });
	}); 
};

UserProvider.prototype.leaveCampaign = function(user, campaignId, callback) {
	this.getCollection(function(error, user_collection) {
      if (error) {
      	callback(error);
      	return;
      }

	  if ((!user) || (!user.id)) {
	  	 callback(error);
	  	 return;
	  }
	  
	  // find the user account to update
	  user_collection.findOne({id: user.id}, function(error, result) {
			if (error) {
				callback(error);
			}
			
			if (!result) {
				// id not found
				callback(null);
			}
			
			// build a list of parents with the new id
			var campaigns = result.campaigns;
			if (campaigns && (campaigns.indexOf(campaignId) >= 0)) {
				// remove the team id
				campaigns.remove(campaigns.indexOf(campaignId))
				user_collection.update({id: user.id}, {$set: {campaigns: campaigns}}, {}, function(error) {
					if (error) { callback(error); return; }

					result.campaigns = campaigns;
					callback(null, result);
				});
			} else {
				callback(null, result);
			}
	  });
	}); 
};


UserProvider.prototype.addRoleByLogin = function(login, role, callback) {
	if (!login) { callback(null, null); return; }

	var provider = this; // need this for the proper scope reference below

	provider.findByLogin(login, function(error, user) {
		
		if (error) { callback(error); return; }
		
		if (!user) { callback(null, null); return; }
	
		console.log("Adding role: " + role + " for login: " + login);
			
		// add the role to the user
		provider.addRole(user, role, function(error, users) {
			if (error) { callback(error); return; }

			console.log("Role " + role + " added. Roles are now: ");
			if (users && users[0]) {
				console.log(users[0].roles);
			}
			callback(null, user);
		});
	});
};

UserProvider.prototype.addRole = function(users, role, callback) {
	this.getCollection(function(error, user_collection) {
		if (error) {
			callback(error);
			return;
		}
		
		if (!users || !role) {
			callback(null);
			return;
		}
	
		if(typeof(users.length)=="undefined") users = [users];
		
		var updateRole = function(user, callback) {
			// find the user account to update
			user_collection.findOne({id: user.id}, function(error, result) {
				if (error) {
					callback(error);
				}
				
				if (!result) {
					// id not found
					callback(null, null);
				}
				
				// build a list of parents with the new id
				var roles = result.roles;
				if (!roles || (roles.indexOf(role) < 0)) {
					// if this isn't already a role, add it
					if (!roles) roles = [];
					roles.push(role);
					user_collection.update({id: user.id}, {$set: {roles: roles}}, {}, function(error) {
						if (error) { callback(error); return; }
						
						console.log("updated.");
						result.roles = roles;
						callback(null, result);
					});
				} else {
					callback(null, result);
				}
			});
		};
		  
		async.map(users, updateRole, function(error, results) {
			if (error) callback(error);
			
			// after everything is done we are happy
			callback(null, results);
		});
	});
};

UserProvider.prototype.removeRole = function(users, role, callback) {
	this.getCollection(function(error, user_collection) {

		if (error) {
			callback(error);
			return;
		}
	
		if (!users || !role) {
			callback(null);
			return;
		}
		  
		if(typeof(users.length)=="undefined") users = [users];
		
		var updateRole = function(user, callback) {
			// find the user account to update
			user_collection.findOne({id: user.id}, function(error, result) {
				if (error) {
					callback(error);
				}
					
				if (!result) {
					// id not found
					callback(null, null);
				}
				
				// build a list of parents with the new id
				var roles = result.roles;
				if (roles && (roles.indexOf(role) > 0)) {
					roles.remove(roles.indexOf(role));
					
					user_collection.update({id: user.id}, {$set: {roles: roles}}, {}, function(error) {
						if (error) { callback(error); return; }
						
						console.log("updated.");
						result.roles = roles;
						callback(null, result);
					});
				} else {
					callback(null, result);
				}
			}); // end user collection find
		};
		  
		async.map(users, updateRole, function(error, results) {
			if (error) callback(error);
			
			// after everything is done we are happy
			callback(null, results);
		});
	});
};

UserProvider.prototype.clearRole = function(role, callback) {
	var provider = this;
	
	console.log("Clearing role: " + role);
	
    this.getCollection(function(error, user_collection) {
    	if (error) { callback(error); return; }
    	
		user_collection.update({}, 
			{$pull: {roles: role}}, {multi: true}, function(error) {
				if (error) { callback(error); return; }
			
				console.log("Cleared role: " + role);
				callback(null);
		});
	});
};


UserProvider.prototype.update = function(users, callback) {
	var provider = this;
    this.getCollection(function(error, user_collection) {
    	if (error) { callback(error); return; }

		if (typeof(users.length)=="undefined") users = [users];

		var updateUser = function(user, callback) {
			console.log("updating user...");
			
			user.update_on = new Date();
			user.gravatar = crypto.createHash('md5').update(user.email).digest("hex");
			user.slug = slugify.slugify(user.login);
			
			var params = {login: user.login, slug: user.slug, update_on: user.update_on, 
			gravatar: user.gravatar, email: user.email, first: user.first, last: user.last,
			account: user.account};
			
			if (user.password && (user.password.length > 0)) {
				user.password = crypto.createHash('md5').update(user.password).digest("hex");
			
				params['password'] = user.password;
			}
			
			user_collection.update({id:user.id}, 
				{$set: params},{}, function(error, updated) {
				console.log("updated.");
				
				callback(null, user);
			});
		};
		  
		async.map(users, updateUser, function(error, results) {
			if (error) callback(error);
			
			// after everything is done we are happy
			callback(null, results);
		});
    });
};

UserProvider.prototype.remove = function(removeId, callback) {
	var provider = this;
    this.getCollection(function(error, user_collection) {
      if( error ) callback(error)
      else {
		user_collection.remove({id:removeId}, {}, function(err, removed) {
			console.log("removed.");
			callback(null, removed);
		});
      } // end else
    });
};

exports.UserProvider = UserProvider;
