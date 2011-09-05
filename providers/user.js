/* TODO: recursive remove bonuses, etc on user remove */

// Array Remove - By John Resig (MIT Licensed)
Array.prototype.remove = function(from, to) {
  var rest = this.slice((to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
};

var crypto = require('crypto');
var Db = require('mongodb').Db;
var Connection = require('mongodb').Connection;
var Server = require('mongodb').Server;
var BSON = require('mongodb').BSON;
var ObjectID = require('mongodb').ObjectID;
var ldap = require('ldapjs');

var slugify = require('./slugify'); // custom slug tools
var parse = require('./parsecsv'); // csv parsing
var async = require('async');

//TODO: add password hashing

UserProvider = function(host, port, ldapUrl, userSearch) {
  this.db= new Db('charity-campaign', new Server(host, port, {auto_reconnect: true}, {}));
  this.db.open(function(){});
  this.ldapUrl = ldapUrl;
  this.userSearch = userSearch;
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
    if( error ) callback(error);
    else callback(null, user_collection);
  });
};

UserProvider.prototype.findAll = function(callback) {
    this.getCollection(function(error, user_collection) {
      if( error ) callback(error)
      else {
        user_collection.find().toArray(function(error, results) {
          if( error ) callback(error)
          else callback(null, results)
        });
      }
    });
};

UserProvider.prototype.findById = function(id, callback) {
    this.getCollection(function(error, user_collection) {
		if (error) {
      		callback(error)
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

UserProvider.prototype.findByTeam = function(teamId, callback) {
    this.getCollection(function(error, user_collection) {
      if( error ) callback(error)
      else {
        user_collection.find({teams: teamId}, {sort: [['login','asc']]}).toArray(function(error, users) {
          if (error) callback(error)
          else callback(null, users)
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
					if (result.password == password) {
						// password match
						callback(null, result);
						return;
					} else {
						// password didn't match
						callback(null, null);
						return;
					}
				}

				// connect to LDAP
				var client = ldap.createClient({
					url: provider.ldapUrl
				});
				
				var searchString = provider.userSearch.replace("[login]", result.account);
				client.bind(searchString, password, function(error) {
					// invalid login
					if (error && (error.code == 49)) { callback(null, null); return; }
				
					// some other kind of error
					if (error) { callback(error); return; }
					
					// success
					callback(null, result);
				});
				
				/*
				var LDAP = new LDAPConnection();
				if (LDAP.open(provider.ldapUrl, 3) < 0) {
					// bad ldap connection
				  	callback(null, null);
				  	return;
				} 
				
				// find the user and try to auth via bind
				var searchString = provider.userSearch.replace("[login]", result.account);
				LDAP.simpleBind(searchString, password, function(messageId, error) {
					if (error) { callback(error); return; }
					callback(null, result);
				});	
				*/
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
			
				// create the user from the record
				provider.save({
					login: record.login,
					password: record.password,
					password2: record.password,
					email: record.email,
					first: record.first,
					last: record.last,
					account: record.account
				}, function(error, users) {
					if (error) return callback(error, null);
					
					callback(null, users[0]);
				});
			};
			
			async.map(records, createUser, function(error, users){
    			callback(error, users);
			});
			
    	}); // end get collection
    }); // end parseCsvFile
};

UserProvider.prototype.joinTeam = function(user, teamId, callback) {
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

UserProvider.prototype.leaveTeam = function(user, teamId, callback) {
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

UserProvider.prototype.addRoleByLogin = function(login, role, callback) {
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
