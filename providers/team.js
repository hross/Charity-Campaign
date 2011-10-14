var Db = require('mongodb').Db;
var Connection = require('mongodb').Connection;
var Server = require('mongodb').Server;
var BSON = require('mongodb').BSON;
var ObjectID = require('mongodb').ObjectID;

var slugify = require('../lib/slugify'); // custom slug tools
var async = require('async');

var config = require('../config'); // config info

TeamProvider = function() {
  this.db = new Db(config.mongodb.dbname, new Server(config.mongodb.host, config.mongodb.port, {auto_reconnect: true}, {}));
  this.db.open(function(error, client){
  	if (typeof config.mongodb.user !== 'string' || typeof config.mongodb.pass !== 'string') return;
  	
  	this.db.authenticate(config.mongodb.user, config.mongodb.pass, function(error) {
  		if (error) console.log(error);
  	});
  });
};

TeamProvider.prototype.getNextTeamId= function(callback) {
	this.getCounterCollection(function(error, counters) {
		if( error ) callback(error)
      	else {
			counters.findAndModify({_id: "teamId"}, [], {$inc: {c: 1}}, {}, function(error, object) {
				if (object) {
					callback(null, object.c + ''); // convert number to string
				} else {
					counters.insert({_id: "teamId", c: 1}, function(error, docs) {
						callback(null, 0 + ''); //convert number to string
					});
				}
			});
      	}
    });
};

TeamProvider.prototype.getCounterCollection= function(callback) {
  this.db.collection('counters', function(error, counter_collection) {
    if( error ) callback(error);
    else callback(null, counter_collection);
  });
};

TeamProvider.prototype.getCollection= function(callback) {
  this.db.collection('teams', function(error, team_collection) {
    if( error ) callback(error);
    else callback(null, team_collection);
  });
};

TeamProvider.prototype.findAll = function(campaignId, callback) {
    this.getCollection(function(error, team_collection) {
      if( error ) callback(error)
      else {
        team_collection.find({campaignId: campaignId}).toArray(function(error, results) {
          if( error ) {
          	callback(error);
          } else {
          	callback(null, results);
          }
        });
      }
    });
};

TeamProvider.prototype.findById = function(id, callback) {
    this.getCollection(function(error, team_collection) {
		if (error) {
      		callback(error)
      	} else {
        	//team_collection.db.bson_serializer.ObjectID.createFromHexString(id)
        	team_collection.findOne({id: id}, function(error, result) {
				if (error) {
					console.log(error);
					callback(error);
				}
				callback(null, result);
			});
		}
    });
};

TeamProvider.prototype.findAllById = function(ids, callback) {
	if (typeof(ids.length)=="undefined") ids = [ids];
	
    this.getCollection(function(error, team_collection) {
      if( error ) callback(error)
      else {
        team_collection.find({id: {$in: ids}}).toArray(function(error, results) {
          if( error ) {
          	callback(error);
          } else {
          	callback(null, results);
          }
        });
      }
    });
};

TeamProvider.prototype.save = function(teams, callback) {
	var provider = this;
    this.getCollection(function(error, team_collection) {
    	if (error) { callback(error); return; }

		if (typeof(teams.length)=="undefined") teams = [teams];

		var createTeam = function(team, callback) {
			console.log("creating team...");
			
			team.created_at = new Date();
			team.update_on = new Date();
			
			provider.getNextTeamId(function(error,id) {
				team.id = id;
				team.slug = slugify.slugify(team.name);
				
				team_collection.insert(team, function() {
					console.log("created.");
					callback(null, team);
				});
			});
		};
		  
		async.map(teams, createTeam, function(error, results) {
			if (error) callback(error);
			
			// after everything is done we are happy
			callback(null, results);
		});
    });
};

TeamProvider.prototype.update = function(teams, callback) {
	var provider = this;
    this.getCollection(function(error, team_collection) {
    	if (error) { callback(error); return; }

		if (typeof(teams.length)=="undefined") teams = [teams];

		var updateTeam = function(team, callback) {
			console.log("updating team...");
			
			team.update_on = new Date();
			team.slug = slugify.slugify(team.name);
			
			team_collection.update({id:team.id}, 
				{$set: {name: team.name, motto: team.motto, 
				update_on: team.update_on, 
				captain: team.captain, 
				sponsor: team.sponsor,
				members: team.members}},{}, function() {
				
				console.log("updated.");
				callback(null, team);
			});
		};
		  
		async.map(teams, updateTeam, function(error, results) {
			if (error) callback(error);

			// after everything is done we are happy
			callback(null, results);
		});
    });
};

TeamProvider.prototype.remove = function(removeId, callback) {
	var provider = this;
    this.getCollection(function(error, team_collection) {
      if( error ) callback(error)
      else {
      	team_collection.findOne({id: removeId}, function(error, result) {
      		if (result) {
				team_collection.remove({id:removeId}, {}, function(err) {
					console.log("removed.");
					callback(null, result.campaignId);
				});
			} else {
				callback(null, null);
			}
		});
      } // end else
    });
};

exports.TeamProvider = TeamProvider;
