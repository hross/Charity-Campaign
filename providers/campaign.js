/* TODO: recursive remove bonuses, etc on campaign remove */

var Db = require('mongodb').Db;
var Connection = require('mongodb').Connection;
var Server = require('mongodb').Server;
var BSON = require('mongodb').BSON;
var ObjectID = require('mongodb').ObjectID;

var slugify = require('../lib/slugify'); // custom slug tools
var async = require('async');

var config = require('../config'); // config info

CampaignProvider = function() {
  this.db = new Db(config.mongodb.dbname, new Server(config.mongodb.host, config.mongodb.port, {auto_reconnect: true}, {}));
  
  var db = this.db;
  this.db.open(function(error, client){
  	if (typeof config.mongodb.user !== 'string' || typeof config.mongodb.pass !== 'string') return;
  	
  	db.authenticate(config.mongodb.user, config.mongodb.pass, function(error) {
  		if (error) console.log(error);
  	});
  });
};

CampaignProvider.prototype.getNextCampaignId= function(callback) {
	this.getCounterCollection(function(error, counters) {
		if( error ) callback(error)
      	else {
			counters.findAndModify({_id: "campaignId"}, [], {$inc: {c: 1}}, {}, function(error, object) {
				if (object) {
					callback(null, object.c + ''); // convert number to string
				} else {
					counters.insert({_id: "campaignId", c: 1}, function(error, docs) {
						callback(null, 0 + ''); //convert number to string
					});
				}
			});
      	}
    });
};

CampaignProvider.prototype.getCounterCollection= function(callback) {
  this.db.collection('counters', function(error, counter_collection) {
    if( error ) callback(error);
    else callback(null, counter_collection);
  });
};

CampaignProvider.prototype.getCollection= function(callback) {
  this.db.collection('campaigns', function(error, campaign_collection) {
    if( error ) callback(error);
    else callback(null, campaign_collection);
  });
};

CampaignProvider.prototype.findAll = function(callback) {
    this.getCollection(function(error, campaign_collection) {
      if( error ) callback(error)
      else {
        campaign_collection.find().toArray(function(error, results) {
          if( error ) callback(error)
          else callback(null, results)
        });
      }
    });
};

CampaignProvider.prototype.findById = function(id, callback) {
    this.getCollection(function(error, campaign_collection) {
		if (error) {
      		callback(error);
      	} else {
        	//campaign_collection.db.bson_serializer.ObjectID.createFromHexString(id)
        	campaign_collection.findOne({id: id}, function(error, result) {
				if (error) {
					console.log(error);
					callback(error);
				}
				callback(null, result);
			});
		}
    });
};

CampaignProvider.prototype.save = function(campaigns, callback) {
	var provider = this;
    this.getCollection(function(error, campaign_collection) {
    	if (error) { callback(error); return; }
    	
    	if (typeof(campaigns.length)=="undefined") campaigns = [campaigns];

		var createCampaign = function(campaign, callback) {
			console.log("creating campaign...");
			provider.getNextCampaignId(function(error, id) {
				if (error) { callback(error); return; }
			
				campaign.id = id;
				campaign.slug = slugify.slugify(campaign.title);
				
				campaign_collection.insert(campaign, function() {
					console.log("created.");
					callback(null, campaign);
				});
			});
		};
		  
		async.map(campaigns, createCampaign, function(error, results) {
			if (error) callback(error);
			
			// after everything is done we are happy
			callback(null, results);
		});
    });
};

CampaignProvider.prototype.update = function(campaigns, callback) {
	var provider = this;
    this.getCollection(function(error, campaign_collection) {
		if (error) { callback(error); return; }
     
		if (typeof(campaigns.length)=="undefined") campaigns = [campaigns];

		var updateCampaign = function(campaign, callback) {
			campaign.slug = slugify.slugify(campaign.title);
		
			campaign_collection.update({id:campaign.id}, 
					{$set: {title: campaign.title, slug: campaign.slug, administrators: campaign.administrators, 
					description: campaign.description, start: campaign.start, end: campaign.end, update_on: campaign.update_on,
					allowjoins: campaign.allowjoins, allowflag: campaign.allowflag}},
					{}, function(error) {
				
				if (error) { callback(error); return; }
					
				console.log("updated.");
				callback(null, campaign);
			});
		};

		async.map(campaigns, updateCampaign, function(error, results) {
			if (error) callback(error);
			
			// after everything is done we are happy
			callback(null, results);
		});
    });
};

CampaignProvider.prototype.remove = function(removeId, callback) {
	var provider = this;
    this.getCollection(function(error, campaign_collection) {
      if( error ) callback(error)
      else {
		campaign_collection.remove({id:removeId}, {}, function(err, removed) {
			console.log("removed.");
			callback(null, removed);
		});
      } // end else
    });
};

exports.CampaignProvider = CampaignProvider;
