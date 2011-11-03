var Db = require('mongodb').Db;
var Connection = require('mongodb').Connection;
var Server = require('mongodb').Server;
var BSON = require('mongodb').BSON;
var ObjectID = require('mongodb').ObjectID;

var slugify = require('../lib/slugify'); // custom slug tools
var async = require('async');

var config = require('../config'); // config info

OfficeProvider = function() {
  this.db = new Db(config.mongodb.dbname, new Server(config.mongodb.host, config.mongodb.port, {auto_reconnect: true}, {}));
  
  var db = this.db;
  this.db.open(function(error, client){
  	if (typeof config.mongodb.user !== 'string' || typeof config.mongodb.pass !== 'string') return;
  	
  	db.authenticate(config.mongodb.user, config.mongodb.pass, function(error) {
  		if (error) console.log(error);
  	});
  });
};

OfficeProvider.prototype.getNextOfficeId= function(callback) {
	this.getCounterCollection(function(error, counters) {
		if( error ) callback(error)
      	else {
			counters.findAndModify({_id: "officeId"}, [], {$inc: {c: 1}}, {}, function(error, object) {
				if (object) {
					callback(null, object.c + ''); // convert number to string
				} else {
					counters.insert({_id: "officeId", c: 1}, function(error, docs) {
						callback(null, 0 + ''); //convert number to string
					});
				}
			});
      	}
    });
};

OfficeProvider.prototype.getCounterCollection= function(callback) {
  this.db.collection('counters', function(error, counter_collection) {
    if( error ) callback(error);
    else callback(null, counter_collection);
  });
};

OfficeProvider.prototype.getCollection= function(callback) {
  this.db.collection('offices', function(error, office_collection) {
    if( error ) callback(error);
    else callback(null, office_collection);
  });
};

OfficeProvider.prototype.findAll = function(campaignId, callback) {
    this.getCollection(function(error, office_collection) {
      if( error ) callback(error)
      else {
        office_collection.find({campaignId: campaignId}, {sort: [['order','asc']]}).toArray(function(error, results) {
          if( error ) {
          	callback(error);
          } else {
          	callback(null, results);
          }
        });
      }
    });
};

OfficeProvider.prototype.findById = function(id, callback) {
    this.getCollection(function(error, office_collection) {
		if (error) {
      		callback(error)
      	} else {
        	//office_collection.db.bson_serializer.ObjectID.createFromHexString(id)
        	office_collection.findOne({id: id}, function(error, result) {
				if (error) {
					console.log(error);
					callback(error);
				}
				callback(null, result);
			});
		}
    });
};

OfficeProvider.prototype.findByName = function(name, callback) {
    this.getCollection(function(error, office_collection) {
		if (error) {
      		callback(error)
      	} else {
        	//office_collection.db.bson_serializer.ObjectID.createFromHexString(id)
        	office_collection.findOne({name: name}, function(error, result) {
				if (error) {
					console.log(error);
					callback(error);
				}
				callback(null, result);
			});
		}
    });
};

OfficeProvider.prototype.save = function(offices, callback) {
	var provider = this;
    this.getCollection(function(error, office_collection) {
    	if (error) { callback(error); return; }

		if (typeof(offices.length)=="undefined") offices = [offices];

		var createOffice = function(office, callback) {
			console.log("creating office...");
			
			provider.findByName(office.name, function(error, foffice) {
				if (foffice) {
					var e = {};
					e.message = "Office already exists!";
					callback(e);
					return;
				}
				
				office.created_at = new Date();
				office.update_on = new Date();
				
				provider.getNextOfficeId(function(error,id) {
					office.id = id;
					office.slug = slugify.slugify(office.name);
					
					office_collection.insert(office, function() {
						console.log("created.");
						callback(null, office);
					});
				});
			});
		};
		  
		async.map(offices, createOffice, function(error, results) {
			if (error) callback(error);
			
			// after everything is done we are happy
			callback(null, results);
		});
    });
};

OfficeProvider.prototype.update = function(offices, callback) {
	var provider = this;
    this.getCollection(function(error, office_collection) {
    	if (error) { callback(error); return; }

		if (typeof(offices.length)=="undefined") offices = [offices];

		var updateOffice = function(office, callback) {
			office.update_on = new Date();
			office.slug = slugify.slugify(office.name);
			
			provider.findByName(office.name, function(error, foffice) {
				if (foffice) {
					var e = {};
					e.message = "Office already exists!";
					callback(e);
					return;
				}
			
				office_collection.update({id:office.id}, 
					{$set: {name: office.name, description: office.description, update_on: office.update_on, order: office.order}},{}, function() {
					console.log("updated.");
					callback(null, office);
				});
			});
		};
		  
		async.map(offices, updateOffice, function(error, results) {
			if (error) callback(error);
			
			// after everything is done we are happy
			callback(null, results);
		});
    });
};

OfficeProvider.prototype.remove = function(removeId, callback) {
	var provider = this;
    this.getCollection(function(error, office_collection) {
      if( error ) callback(error)
      else {
      	office_collection.findOne({id: removeId}, function(error, result) {
      		if (result) {
				office_collection.remove({id:removeId}, {}, function(err) {
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

exports.OfficeProvider = OfficeProvider;
