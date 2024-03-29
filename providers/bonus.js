var Db = require('mongodb').Db;
var Connection = require('mongodb').Connection;
var Server = require('mongodb').Server;
var BSON = require('mongodb').BSON;
var ObjectID = require('mongodb').ObjectID;

var config = require('../config'); // config info

var slugify = require('../lib/slugify'); // custom slug tools
var async = require('async');

BonusProvider = function() {
  this.db = new Db(config.mongodb.dbname, new Server(config.mongodb.host, config.mongodb.port, {auto_reconnect: true}, {}));
  
  var db = this.db;
  this.db.open(function(error, client){
  	if (typeof config.mongodb.user !== 'string' || typeof config.mongodb.pass !== 'string') return;
  	
  	db.authenticate(config.mongodb.user, config.mongodb.pass, function(error) {
  		if (error) console.log(error);
  	});
  });
};

BonusProvider.prototype.getNextBonusId= function(callback) {
	this.getCounterCollection(function(error, counters) {
		if( error ) callback(error)
      	else {
			counters.findAndModify({_id: "bonusId"}, [], {$inc: {c: 1}}, {}, function(error, object) {
				if (object) {
					callback(null, object.c + ''); // convert number to string
				} else {
					counters.insert({_id: "bonusId", c: 1}, function(error, docs) {
						callback(null, 0 + ''); //convert number to string
					});
				}
			});
      	}
    });
};

BonusProvider.prototype.getCounterCollection= function(callback) {
  this.db.collection('counters', function(error, counter_collection) {
    if( error ) callback(error);
    else callback(null, counter_collection);
  });
};

BonusProvider.prototype.getCollection= function(callback) {
  this.db.collection('bonuses', function(error, bonus_collection) {
    if( error ) callback(error);
    else callback(null, bonus_collection);
  });
};

BonusProvider.prototype.findAll = function(campaignId, callback) {
    this.getCollection(function(error, bonus_collection) {
      if( error ) callback(error)
      else {
        bonus_collection.find({campaignId: campaignId}).sort({'title':'asc'}).toArray(function(error, results) {
          if( error ) {
          	callback(error);
          } else {
          	callback(null, results);
          }
        });
      }
    });
};

BonusProvider.prototype.findById = function(id, callback) {
    this.getCollection(function(error, bonus_collection) {
		if (error) {
      		callback(error)
      	} else {
        	//bonus_collection.db.bson_serializer.ObjectID.createFromHexString(id)
        	bonus_collection.findOne({id: id}, function(error, result) {
				if (error) {
					console.log(error);
					callback(error);
				}
				callback(null, result);
			});
		}
    });
};

BonusProvider.prototype.findByIds = function(ids, callback) {
	if (typeof(ids.length)=="undefined") ids = [ids];
	
    this.getCollection(function(error, bonus_collection) {
		if (error) {
      		callback(error)
      	} else {
        	bonus_collection.find({id: {$in: ids}}).sort({'title': 'asc'}).toArray(function(error, results) {
				if (error) {
					console.log(error);
					callback(error);
				}
				callback(null, results);
			});
		}
    });
};

BonusProvider.prototype.findTypeWithin = function(type, dt, callback) {
    this.getCollection(function(error, bonus_collection) {
		if (error) {
      		callback(error)
      	} else {
      		// search for bonuses for this type where dt is between start and end date
        	bonus_collection.find({type: type, start: {$lte: dt}, end: {$gte: dt}}).sort({'title': 'asc'}).toArray(function(error, result) {
				if (error) {
					console.log(error);
					callback(error);
				}
				callback(null, result);
			});
		}
    });
};

BonusProvider.prototype.findActive = function(campaignId, dt, callback) {
    this.getCollection(function(error, bonus_collection) {
		if (error) {
      		callback(error);
      	} else {
      		// search for bonuses for this type where dt is between start and end date
        	bonus_collection.find({campaignId: campaignId, bonustype: {$ne: 'spot'}, start: {$lte: dt}, end: {$gte: dt}
        		}).sort({'title':'asc'}).toArray(function(error, result) {

				if (error) {
					console.log(error);
					callback(error);
				}
				callback(null, result);
			});
		}
    });
};

BonusProvider.prototype.findActiveSpot = function(campaignId, dt, callback) {
    this.getCollection(function(error, bonus_collection) {
		if (error) {
      		callback(error);
      	} else {
      		// search for spot bonuses for this campaign which are not completed
        	bonus_collection.find({campaignId: campaignId, bonustype: 'spot', 
        		$or: [ {completed: null}, {completed: false} ]
        	}).sort({'title': 'asc'}).toArray(function(error, result) {

				if (error) {
					console.log(error);
					callback(error);
				}
				callback(null, result);
			});
		}
    });
};

BonusProvider.prototype.save = function(bonuses, callback) {
	var provider = this; // needed for scope reference
    this.getCollection(function(error, bonus_collection) {
      	if (error) { callback(error); return; }
		
		if( typeof(bonuses.length)=="undefined") bonuses = [bonuses];
          
		var createBonus = function(bonus, callback) {
			console.log("creating bonus...");
			provider.getNextBonusId(function(error,id) {
				bonus.id = id;
				bonus.slug = slugify.slugify(bonus.title);
				
				bonus_collection.insert(bonus, function() {
					console.log("created.");
					callback(null, bonus);
				});
			});
		};
		  
		async.map(bonuses, createBonus, function(error, results) {
			if (error) callback(error);
			
			// after everything is done we are happy
			callback(null, results);
		});
    });
};

BonusProvider.prototype.update = function(bonuses, callback) {
    this.getCollection(function(error, bonus_collection) {
    	if (error) { callback(error); return; }
      
      	if (typeof(bonuses.length)=="undefined") bonuses = [bonuses];
      	
		var updateBonus = function(bonus, callback) {
			bonus.slug = slugify.slugify(bonus.title);
			
			bonus_collection.update({id:bonus.id}, 
				{$set: {title: bonus.title, description: bonus.description, name: bonus.name, 
				points: bonus.points, update_on: bonus.update_on, type: bonus.type, 
				start: bonus.start, end: bonus.end, slug: bonus.slug, 
				total: bonus.total, numteams: bonus.numteams, pointsoritems: bonus.pointsoritems,
				bonustype: bonus.bonustype, spotpoints: bonus.spotpoints, completed: bonus.completed,
				winners: bonus.winners, completed_on: bonus.completed_on, autoassign: bonus.autoassign}},{}, function() {
				console.log("updated.");
				callback(null, bonus);
			});
		};
		  
		async.map(bonuses, updateBonus, function(error, results) {
			if (error) callback(error);
			
			// after everything is done we are happy
			callback(null, results);
		});
    });
};

BonusProvider.prototype.remove = function(removeId, callback) {
    this.getCollection(function(error, bonus_collection) {
      if( error ) callback(error)
      else {
      	bonus_collection.findOne({id: removeId}, function(error, result) {
      		if (result) {
				bonus_collection.remove({id:removeId}, {}, function(err) {
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

exports.BonusProvider = BonusProvider;
