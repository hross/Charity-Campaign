var Db = require('mongodb').Db;
var Connection = require('mongodb').Connection;
var Server = require('mongodb').Server;
var BSON = require('mongodb').BSON;
var ObjectID = require('mongodb').ObjectID;

var slugify = require('../lib/slugify'); // custom slug tools
var async = require('async');

var config = require('../config'); // config info

ItemTypeProvider = function() {
  this.db = new Db(config.mongodb.dbname, new Server(config.mongodb.host, config.mongodb.port, {auto_reconnect: true}, {}));
  this.db.open(function(error, client){
  	if (typeof config.mongodb.user !== 'string' || typeof config.mongodb.pass !== 'string') return;
  	
  	this.db.authenticate(config.mongodb.user, config.mongodb.pass, function(error) {
  		if (error) console.log(error);
  	});
  });
};

ItemTypeProvider.prototype.getNextItemTypeId= function(callback) {
	this.getCounterCollection(function(error, counters) {
		if( error ) callback(error)
      	else {
			counters.findAndModify({_id: "itemtypeId"}, [], {$inc: {c: 1}}, {}, function(error, object) {
				if (object) {
					callback(null, object.c + ''); // convert number to string
				} else {
					counters.insert({_id: "itemtypeId", c: 1}, function(error, docs) {
						callback(null, 0 + ''); //convert number to string
					});
				}
			});
      	}
    });
};

ItemTypeProvider.prototype.getCounterCollection= function(callback) {
  this.db.collection('counters', function(error, counter_collection) {
    if( error ) callback(error);
    else callback(null, counter_collection);
  });
};

ItemTypeProvider.prototype.getCollection= function(callback) {
  this.db.collection('itemtypes', function(error, itemtype_collection) {
    if( error ) callback(error);
    else callback(null, itemtype_collection);
  });
};

ItemTypeProvider.prototype.findAll = function(campaignId, callback) {
    this.getCollection(function(error, itemtype_collection) {
      if( error ) callback(error)
      else {
        itemtype_collection.find({campaignId: campaignId}).toArray(function(error, results) {
          if( error ) {
          	callback(error);
          } else {
          	callback(null, results);
          }
        });
      }
    });
};

ItemTypeProvider.prototype.findById = function(id, callback) {
    this.getCollection(function(error, itemtype_collection) {
		if (error) {
      		callback(error)
      	} else {
        	//itemtype_collection.db.bson_serializer.ObjectID.createFromHexString(id)
        	itemtype_collection.findOne({id: id}, function(error, result) {
				if (error) {
					console.log(error);
					callback(error);
				}
				callback(null, result);
			});
		}
    });
};

ItemTypeProvider.prototype.findSystemBonus = function(callback) {
    this.getCollection(function(error, itemtype_collection) {
		if (error) {
      		callback(error)
      	} else {
        	//itemtype_collection.db.bson_serializer.ObjectID.createFromHexString(id)
        	itemtype_collection.findOne({system: true}, function(error, result) {
				if (error) {
					console.log(error);
					callback(error);
				}
				callback(null, result);
			});
		}
    });
};

ItemTypeProvider.prototype.save = function(itemtypes, callback) {
	var provider = this;
    this.getCollection(function(error, itemtype_collection) {
    	if (error) { callback(error); return; }

		if (typeof(itemtypes.length)=="undefined") itemtypes = [itemtypes];

		var createItemType = function(itemtype, callback) {
			console.log("creating itemtype...");
			
			itemtype.created_at = new Date();
			itemtype.update_on = new Date();
			
			provider.getNextItemTypeId(function(error,id) {
				itemtype.id = id;
				itemtype.slug = slugify.slugify(itemtype.name);
				
				itemtype_collection.insert(itemtype, function() {
					console.log("created.");
					callback(null, itemtype);
				});
			});
		};
		  
		async.map(itemtypes, createItemType, function(error, results) {
			if (error) callback(error);
			
			// after everything is done we are happy
			callback(null, results);
		});
    });
};

ItemTypeProvider.prototype.update = function(itemtypes, callback) {
	var provider = this;
    this.getCollection(function(error, itemtype_collection) {
    	if (error) { callback(error); return; }

		if (typeof(itemtypes.length)=="undefined") itemtypes = [itemtypes];

		var updateItemType = function(itemtype, callback) {
			itemtype.update_on = new Date();
			itemtype.slug = slugify.slugify(itemtype.name);
			
			itemtype_collection.update({id:itemtype.id}, 
				{$set: {name: itemtype.name, description: itemtype.description, visible: itemtype.visible, points: itemtype.points, update_on: itemtype.update_on}},{}, function() {
				console.log("updated.");
				callback(null, itemtype);
			});
		};
		  
		async.map(itemtypes, updateItemType, function(error, results) {
			if (error) callback(error);
			
			// after everything is done we are happy
			callback(null, results);
		});
    });
};

ItemTypeProvider.prototype.remove = function(removeId, callback) {
	var provider = this;
    this.getCollection(function(error, itemtype_collection) {
      if( error ) callback(error)
      else {
      	itemtype_collection.findOne({id: removeId}, function(error, result) {
      		if (result) {
				itemtype_collection.remove({id:removeId}, {}, function(err) {
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

exports.ItemTypeProvider = ItemTypeProvider;
