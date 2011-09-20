var Db = require('mongodb').Db;
var Connection = require('mongodb').Connection;
var Server = require('mongodb').Server;
var BSON = require('mongodb').BSON;
var ObjectID = require('mongodb').ObjectID;

var slugify = require('../lib/slugify'); // custom slug tools
var async = require('async');

ItemProvider = function(host, port) {
  this.db= new Db('charity-campaign', new Server(host, port, {auto_reconnect: true}, {}));
  this.db.open(function(){});
};

ItemProvider.prototype.getNextItemId= function(callback) {
	this.getCounterCollection(function(error, counters) {
		if( error ) callback(error)
      	else {
			counters.findAndModify({_id: "itemId"}, [], {$inc: {c: 1}}, {}, function(error, object) {
				if (object) {
					callback(null, object.c + ''); // convert number to string
				} else {
					counters.insert({_id: "itemId", c: 1}, function(error, docs) {
						callback(null, 0 + ''); //convert number to string
					});
				}
			});
      	}
    });
};

ItemProvider.prototype.getCounterCollection= function(callback) {
  this.db.collection('counters', function(error, counter_collection) {
    if( error ) callback(error);
    else callback(null, counter_collection);
  });
};

ItemProvider.prototype.getCollection= function(callback) {
  this.db.collection('items', function(error, item_collection) {
    if( error ) callback(error);
    else callback(null, item_collection);
  });
};

ItemProvider.prototype.findByCampaign = function(campaignId, limit, callback) {
    this.getCollection(function(error, item_collection) {
		if (error) { callback(error); return; }

		var params = {sort: [['created_at','desc']]};
		if (limit) params['limit'] = limit;
		
        item_collection.find({campaignId: campaignId, $or: [{admin: false}, {admin: undefined}]}, params).toArray(function(error, results) {
        	if (error) { callback(error); return; }

          	callback(null, results);
		});
    });
};

ItemProvider.prototype.findAll = function(teamId, limit, callback) {
    this.getCollection(function(error, item_collection) {
		if (error) { callback(error); return; }

		var params = {sort: [['created_at','desc']]};
		if (limit) params['limit'] = limit;
		
        item_collection.find({teamId: teamId}, params).toArray(function(error, results) {
        	if (error) { callback(error); return; }

          	callback(null, results);
		});
    });
};

ItemProvider.prototype.findByTeam = function(teamId, limit, callback) {
    this.getCollection(function(error, item_collection) {
		if (error) { callback(error); return; }

		var params = {sort: [['created_at','desc']]};
		if (limit) params['limit'] = limit;
		
        item_collection.find({teamId: teamId}, params).toArray(function(error, results) {
        	if (error) { callback(error); return; }

          	callback(null, results);
		});
    });
};

ItemProvider.prototype.findByUser = function(userId, limit, callback) {
    this.getCollection(function(error, item_collection) {
		if (error) { callback(error); return; }

		var params = {sort: [['created_at','desc']]};
		if (limit) params['limit'] = limit;

		item_collection.find({created_by: userId, $or: [{admin: false}, {admin: undefined}]}, params).toArray(function(error, results) {
			if (error) { callback(error); return; }

			callback(null, results);
		});
    });
};

ItemProvider.prototype.findByUserCampaign = function(userId, campaignId, limit, callback) {
    this.getCollection(function(error, item_collection) {
		if (error) { callback(error); return; }

		var params = {sort: [['created_at','desc']]};
		if (limit) params['limit'] = limit;

		item_collection.find({created_by: userId, campaignId: campaignId, $or: [{admin: false}, {admin: undefined}]}, params).toArray(function(error, results) {
			if (error) { callback(error); return; }

			callback(null, results);
		});
    });
};

ItemProvider.prototype.findById = function(id, callback) {
    this.getCollection(function(error, item_collection) {
		if (error) {
      		callback(error)
      	} else {
        	//item_collection.db.bson_serializer.ObjectID.createFromHexString(id)
        	item_collection.findOne({id: id}, function(error, result) {
				if (error) {
					console.log(error);
					callback(error);
				}
				callback(null, result);
			});
		}
    });
};

ItemProvider.prototype.save = function(items, callback) {
	var provider = this;
    this.getCollection(function(error, item_collection) {
    	if (error) { callback(error); return; }

		if (typeof(items.length)=="undefined") items = [items];

		var createItem = function(item, callback) {
			console.log("creating item...");
			
			item.created_at = new Date(); 
			item.update_on = new Date();
			item.flagged = false;
			item.verified = false;
			
			provider.getNextItemId(function(error,id) {
				item.id = id;
				item.slug = slugify.slugify(item.name);
				
				item_collection.insert(item, function() {
					console.log("created.");
					callback(null, item);
				});
			});
		};
		  
		async.map(items, createItem, function(error, results) {
			if (error) callback(error);
			
			// after everything is done we are happy
			callback(null, results);
		});
    });
};

ItemProvider.prototype.update = function(items, callback) {
    this.getCollection(function(error, item_collection) {
    	if (error) { callback(error); return; }

		if (typeof(items.length)=="undefined") items = [items];

		var updateItem = function(item, callback) {
			console.log("updating item...");
			
			item.update_on = new Date();
			item.slug = slugify.slugify(item.name);

			item_collection.update({id:item.id}, 
				{$set: {campaignId: item.campaignId, type: item.type, name:item.name, 
				bonus: item.bonus, description: item.description, quantity: item.quantity, 
				verified: item.verified, flagged: item.flagged, admin: item.admin, points: item.points, slug: item.slug,
				user: item.userId, update_on: item.update_on, office: item.office}},{}, function() {
				console.log("updated.");
				callback(null, item);
			});
		};
		  
		async.map(items, updateItem, function(error, results) {
			if (error) callback(error);
			
			// after everything is done we are happy
			callback(null, results);
		});
    });
};

ItemProvider.prototype.flag = function(login, itemId, callback) {
    this.getCollection(function(error, item_collection) {
    	if (error) { callback(error); return; }
      
      	item_collection.update({id:itemId}, {$set: {flagged: true, flagged_by: login}},{}, function() {
			console.log("Item " + itemId + " flagged.");
			callback(null, null);
		});
    });
};

ItemProvider.prototype.verify = function(login, itemId, callback) {
    this.getCollection(function(error, item_collection) {
    	if (error) { callback(error); return; }
      
      	item_collection.update({id:itemId}, {$set: {verified: true, verified_by: login}},{}, function() {
			console.log("Item " + itemId + " verified.");
			callback(null, null);
		});
    });
};

ItemProvider.prototype.remove = function(removeId, callback) {
	var provider = this;
    this.getCollection(function(error, item_collection) {
      if( error ) callback(error)
      else {
      	item_collection.findOne({id: removeId}, function(error, result) {
      		if (result) {
				item_collection.remove({id:removeId}, {}, function(err) {
					console.log("removed.");
					callback(null, result.teamId);
				});
			} else {
				callback(null, null);
			}
		});
      } // end else
    });
};

ItemProvider.prototype.teamPoints = function(teamId, callback) {
    this.getCollection(function(error, item_collection) {
      if (error) callback(error);
      
		item_collection.group(
			{teamId: true},	// keys (this is our "group by")
			{teamId: teamId}, 	// condition (this is our filter)
			{sum: 0},			// initial
			function (doc, prev) { prev.sum += (parseInt(doc.points) + parseInt(doc.bonus)) * parseInt(doc.quantity); }, // reduce
			false,				// command
		function(error, results) {
			if (error) { callback(error); return; }
	
			if (results && results.length > 0) {
				var sum = results[0].sum;
				if (!sum || isNaN(sum)) sum = 0;
				callback(null, sum);
			} else {
				callback(null, 0);
			}
		});
    });
};

ItemProvider.prototype.userPoints = function(userId, campaignId, callback) {
    this.getCollection(function(error, item_collection) {
      if (error) callback(error);
      
		item_collection.group(
			{created_by: true},	// keys (this is our "group by")
			{created_by: userId, campaignId: campaignId, admin: false || undefined}, 	// condition (this is our filter)
			{sum: 0},			// initial
			function (doc, prev) { prev.sum += (parseInt(doc.points) + parseInt(doc.bonus)) * parseInt(doc.quantity); }, // reduce
			false,				// command
		function(error, results) {
			if (error) { callback(error); return; }
	
			if (results && results.length > 0) {
				var sum = results[0].sum;
				if (!sum || isNaN(sum)) sum = 0;
				callback(null, sum);
			} else {
				callback(null, 0);
			}
		});
    });
};

ItemProvider.prototype.userPointTotals = function(campaignId, callback) {
    this.getCollection(function(error, item_collection) {
      if (error) callback(error);
      
		item_collection.group(
			{created_by: true},	// keys (this is our "group by")
			{campaignId: campaignId, admin: false || undefined}, 	// condition (this is our filter)
			{points: 0},			// initial
			function (doc, prev) { prev.points += (parseInt(doc.points) + parseInt(doc.bonus)) * parseInt(doc.quantity); }, // reduce
			false,				// command
		function(error, results) {
			if (error) { callback(error); return; }
			callback(null, results);
		});
    });
};

exports.ItemProvider = ItemProvider;
