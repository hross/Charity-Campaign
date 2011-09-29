/*var check = require('validator').check,
    sanitize = require('validator').sanitize;*/
    
var config = require('../config');

// instantiate bonus provider
var BonusProvider = require('../providers/bonus').BonusProvider;
var bonusProvider = new BonusProvider(config.mongodb.host, config.mongodb.port);

// instantiate itemtype provider
var ItemTypeProvider = require('../providers/itemtype').ItemTypeProvider;
var itemTypeProvider = new ItemTypeProvider(config.mongodb.host, config.mongodb.port);

// instantiate item provider
var ItemProvider = require('../providers/item').ItemProvider;
var itemProvider = new ItemProvider(config.mongodb.host, config.mongodb.port);

var dateformat = require('../lib/dateformat'); // custom date tools
var async = require('async');
var _ = require('underscore')._;

var CAMPAIGN_ADMIN_ROLE = config.roles.CAMPAIGN_ADMIN_ROLE;
var ADMIN_ROLE = config.roles.ADMIN_ROLE;

module.exports = {
  
  // list
  
  index: function(req, res){
  	var campaignId = req.params.parentId;
  	
	var isAdmin = (req.session.user && req.session.user.roles &&
    			  (req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
    			  req.session.user.roles.indexOf(ADMIN_ROLE)>=0));
  	
  	if (campaignId) {
		bonusProvider.findAll(campaignId, function(error, bonuses) {
			if (error) return next(error);
			res.render(null, {locals: {bonuses: bonuses, campaignId: campaignId, isAdmin: isAdmin}});
		});
	} else {
		bonusProvider.findAll(null, function(error, bonuses) {
			if (error) return next(error);
        	res.render(null, {locals: {bonuses: bonuses, campaignId: null, isAdmin: isAdmin}});
    	});
	}
  },
  
  // list active
  
  active: function(req, res){
  	var campaignId = req.params.parentId;
  	
	var isAdmin = (req.session.user && req.session.user.roles &&
    			  (req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
    			  req.session.user.roles.indexOf(ADMIN_ROLE)>=0));
  	
  	if (campaignId) {
		bonusProvider.findActive(campaignId, new Date(), function(error, bonuses) {
			if (error) return next(error);
			res.render(null, {locals: {bonuses: bonuses, campaignId: campaignId, isAdmin: isAdmin}});
		});
	} else {
		bonusProvider.findAll(null, function(error, bonuses) {
			if (error) return next(error);
        	res.render(null, {locals: {bonuses: bonuses, campaignId: null, isAdmin: isAdmin}});
    	});
	}
  },

  // single display
  
  show: function(req, res, next){
    bonusProvider.findById(req.params.id, function(error, bonus) {
    	if (error) return next(error);
    	
    	if (!bonus) {
    		req.flash("Could not find that bonus.");
    		res.render(null, {locals:{bonus: null}});
    		return;
    	}
    	
    	var campaignId = bonus.campaignId;
    	
		var isAdmin = (req.session.user && req.session.user.roles &&
			  (req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
			  req.session.user.roles.indexOf(ADMIN_ROLE)>=0));
    	
    	// convert date/times for display
    	if (bonus.start) {
			bonus.start = dateformat.dateFormat(bonus.start, "dddd, mmmm d, yyyy HH:MM");
			bonus.end = dateformat.dateFormat(bonus.end, "dddd, mmmm d, yyyy HH:MM");
    	} else {
    		bonus.start = "";
    		bonus.end = "";
    	}
    	
    	itemProvider.findByBonus(bonus.id, 100, function(error, items) {
    		if (items) {
    			for (var i = 0; i < items.length; i++) {
    				items[i].created_at_format = dateformat.dateFormat(items[i].created_at, "dddd, mmmm d, yyyy HH:MM");
    			}
    		}
    	
    		res.render(null, {locals:{bonus: bonus, campaignId: campaignId, isAdmin: isAdmin, items: items}});
    	});
    });
  },
  
  // edit screen
  
  edit: function(req, res, next){
    bonusProvider.findById(req.params.id, function(error, bonus) {
    	if (error) return next(error);
    	
    	if (!bonus) {
    		req.flash("Could not find that bonus.");
    		res.redirect('back');
    		return;
    	}
    	
    	if (!bonus.end) bonus.end = "";
    	if (!bonus.start) bonus.start = "";
    	
    	var campaignId = bonus.campaignId;
    	
		var isAdmin = (req.session.user && req.session.user.roles &&
			  (req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
			  req.session.user.roles.indexOf(ADMIN_ROLE)>=0));
			  
		if (!isAdmin) {
			req.push('error', 'You do not have permission to edit bonuses.');
			res.redirect('back');
			return;
		}
    	
    	itemTypeProvider.findAll(bonus.campaignId, function(error, itemTypes) {
			if (error) return next(error);
			
			var campaignId = bonus.campaignId;
			var isAdmin = (req.session.user && req.session.user.roles &&
			  (req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
			  req.session.user.roles.indexOf(ADMIN_ROLE)>=0));
			
			if (!itemTypes) {
				res.render(null, {locals:{bonus: bonus, itemTypes: [], campaignId: campaignId, isAdmin: isAdmin}});
			} else {
				res.render(null, {locals:{bonus: bonus, itemTypes: itemTypes, campaignId: campaignId, isAdmin: isAdmin}});
			}
		});
    });
  },
  
  // create screen
  
  add: function(req, res, next){
  	var campaignId = req.params.parentId;
  	
	var isAdmin = (req.session.user && req.session.user.roles &&
	  (req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
	  req.session.user.roles.indexOf(ADMIN_ROLE)>=0));

	if (!isAdmin) {
		req.push('error', 'You do not have permission to create bonuses.');
		res.redirect('back');
		return;
	}
  	
	itemTypeProvider.findAll(campaignId, function(error, itemTypes) {
		if (error) return next(error);
		
		if (!itemTypes) {
			res.render(null, {locals: {campaignId: campaignId, itemTypes: []}});
		} else {
			res.render(null, {locals:{campaignId: campaignId, itemTypes: itemTypes}});
		}
	});
  },
  
  // handle create post
  
  create: function(req, res, next){
  
    var campaignId = req.param("campaignId");
    
	var title = req.param('title');
	var	description = req.param('description');
	
	var	start = new Date(req.param('start'));
	var	end = new Date(req.param('end'));
	var	points = req.param('points');
	var	type = req.param("type");
	
	var	spotstart = null;
	var	spotend = null;
	if (req.param('spotstart')) {
		spotstart = new Date(req.param('spotstart'));
		spotend = new Date(req.param('spotend'));
	}
	
	var	total = req.param('total');
	var	numteams = req.param("numteams");
	var	pointsoritems = req.param("pointsoritems");
	var	spottype = req.param("spottype");
	var bonustype = req.param("bonustype");
	var spotpoints = req.param("spotpoints");
	var name = "";
    
  	var isAdmin = (req.session.user && req.session.user.roles &&
	  (req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
	  req.session.user.roles.indexOf(ADMIN_ROLE)>=0));
	  
	if (!isAdmin) {
		req.push('error', 'You do not have permission to create bonuses.');
		res.redirect('back');
		return;
	}
	
	var type = req.param('type');
	if ('spot' == bonus.bonustype) {
		type = spottype;
		start = spotstart;
		end = spotend;
	}
	
  	itemTypeProvider.findById(type, function(error, itemType) {
    	if (error) return next(error);
    	if (!itemType && ('spot' != bonustype)) {
    		req.flash('info', 'No item type specified!');
    		res.redirect('back');
    		return;
    	}
    	
    	if (itemType) name = itemType.name;
  
		bonusProvider.save({
			title: title,
			description: description,
			name: name,
			campaignId: campaignId,
			start: start,
			end: end,
			points: points,
			type: type,
			total: total,
			numteams: numteams,
			pointsoritems: pointsoritems,
			bonustype: bonustype,
			spotpoints: spotpoints
		}, function( error, bonuses) {
			if (error) return next(error);
			
			if (bonuses[0]) {
				req.flash('info', 'Created bonus _' + bonuses[0].name + '_');
				res.redirect("/bonuses/show/" + bonuses[0].id);
			} else {
				res.redirect('/bonuses');
			}
		});
	});
  },
  
  // update an item
  
  update: function(req, res, next){
    var campaignId = req.param("campaignId");
    
	var title = req.param('title');
	var	description = req.param('description');
	var	start = new Date(req.param('start'));
	var	end = new Date(req.param('end'));
	var	points = req.param('points');
	var	type = req.param("type");
	
	var	spotstart = null;
	var	spotend = null;
	if (req.param('spotstart')) {
		spotstart = new Date(req.param('spotstart'));
		spotend = new Date(req.param('spotend'));
	}
	
	var	total = req.param('total');
	var	numteams = req.param("numteams");
	var	pointsoritems = req.param("pointsoritems");
	var	spottype = req.param("spottype");
	var bonustype = req.param("bonustype");
	var spotpoints = req.param("spotpoints");
	
	var name = "";
    
	var isAdmin = (req.session.user && req.session.user.roles &&
	  (req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
	  req.session.user.roles.indexOf(ADMIN_ROLE)>=0));
	  
	if (!isAdmin) {
		req.push('error', 'You do not have permission to update bonuses.');
		res.redirect('back');
		return;
	}

	var type = req.param('type');
	if ('spot' == bonustype) {
		type = spottype;
		start = spotstart;
		end = spotend;
	}
  
  	itemTypeProvider.findById(type, function(error, itemType) {
    	if (error) return next(error);
    	if (!itemType && ('spot' != bonustype)) {
    		req.flash('info', 'No item type specified!');
    		res.redirect('back');
    		return;
    	}
    	
    	if (itemType) name = itemType.name;
  
		bonusProvider.update({
			title: title,
			description: description,
			name: name,
			id: req.params.id,
			campaignId: campaignId,
			start: start,
			end: end,
			points: points,
			type: type,
			total: total,
			numteams: numteams,
			pointsoritems: pointsoritems,
			bonustype: bonustype,
			spotpoints: spotpoints
		}, function(error, bonuses) {
			if (error) return next(error);
	
			req.flash('info', 'Successfully updated _' + bonuses[0].title + '_.');
			res.redirect('/bonuses/show/' + bonuses[0].id);
		});
	});
  },
  
  
  // recalculate a bonus
  recalculate: function(req, res, next){
	bonusProvider.findById(req.params.id, function(error, bonus) {
		if (error) return next(error);
		
		if (!bonus) {
			req.flash('error', 'Could not find bonus.');
			res.redirect('back');
		}
		
		if ('spot' != bonus.bonustype) {
			req.flash('error', 'Only spot bonuses require calculation.');
			res.redirect('back');
		}
		
		itemTypeProider.findSystemBonus(function(error, itemType) {
		
			itemProvider.findByBonus(bonus.id, 0, function(error, items) {
				if (error) return next(error);
				
				// build a function to delete items
				var deleteItem = function(item, callback) {
					console.log("deleting item...");
					itemProvider.remove(item.id, function(error, removed) {
						callback(error, removed);
					});
				};
				
				// do the actual deletes
				async.map(items, deleteItem, function(error, results) {
					if (error) return next(error);
					
					// find all items corresponding to this bonus
					itemProvider.findByCreation(bonus.campaignId, bonus.start, bonus.end, 0, function(error, items) {
						// go through each item and track totals
						var totals = {};
						var winners = []; // keep track of winning teams for later
						var winItems = []; // keep winning items for later updates
						var numteams = bonus.numteams;
						
						for (var i = 0; i < items.length; i++) {
							// we are only counting this item if it counts toward the bonus
							if ((bonus.type < 0) || (bonus.type == item.type)) {
								if (!total[item.teamId]) total[item.teamId] = 0; // init blank team values
							
								// increment our total
								if ('points' == bonus.pointsoritems) {
									var points = (parseInt(item.points) + parseInt(item.bonus)) * parseInt(item.quantity);
									total[item.teamId] += points
								} else {
									total[item.teamId] += item.quantity;
								}
								
								// if we passed bonus threshold and we aren't already a winner
								if ((total[item.teamId] > bonus.total) && !_.contains(winners, item.teamId)) {
									// this team is a winner
									winners.push(item.teamId);
									winItems.push(item);
									numteams--;
									if (!numteams) break; // break out of the loop if we hit the maximum number of winners
								}
							}
						
							console.log(items[i].created_at);
						}
						
						console.log("bonus calculations:");
						console.log(winners);
						console.log(winItems);
						console.log(totals);
						console.log(numteams);
						
						// remove this to actually do stuff after calcs
						req.flash('info', 'Successfully recalculated _' + bonus.title + '_.');
						res.redirect('back');
						return;
						
						// this function sets the bonus for each winning item
						var setBonus = function(item, callback) {
							// update the item with some information about the bonus
							item.winner.push(bonus.id);
							
							itemProvider.update(item, function(error, uitem) {
								if (error) { callback(error); return; }
								
								var bi = {};
								bi[bonus.id] = parseInt(bonus.spotpoints);
								
								// add a bonus point item for the winning team
								itemProvider.save({
									type: itemType.id, // system bonus point type
									name: itemType.name,
									points: 0,
									bonus: bonus.spotpoints,
									campaignId: bonus.campaignId,
									description: "Bonus Points for " + bonus.title + " Bonus",
									teamId: item.teamId,
									quantity: 1,
									created_by: req.session.user.id,
									updated_by: req.session.user.login,
									created_by_login: req.session.user.login,
									admin: true,
									office: "",
									bonuses: [bonus.id],
									bonusvalues: [bi]
								}, function(error, items) {
									if (error) callback(error);
									
									callback(null, items[0]);
								}); // end item update
							}); // end original item update
						};
						
						// update the bonus with completion if it is fulfilled or the end date is past
						var now = new Date();
						if ((now > bonus.end) || (!numteams)) {
							bonus.completed = true;
						} else {
							bonus.completed = false;
						}
						
						// run the update
						bonusProvider.update(bonus, function(error, bonus) {
							if (error) return next(error);
							
							// add/update all of the items
							async.map(winItems, setBonus, function(error, items) {
								if (error) return next(error);
								
								// after everything is done we are happy
								req.flash('info', 'Successfully recalculated _' + bonus.title + '_.');
								res.redirect('back');
							});
						});
					}); // find by creation date
				}); // map deletes
			}); // find item
		}); // find item types
	}); // find bonus
  },
  
  // destroy the bonus
  
  destroy: function(req, res, next){
  	bonusProvider.findById(req.params.id, function(error, bonus) {
  		if (error) return next(error);
  		
  		if (!bonus) {
			req.push('error', 'This bonus does not exist.');
			res.redirect('back');
			return;
  		}
  		
		var campaignId = bonus.campaignId;

		var isAdmin = (req.session.user && req.session.user.roles &&
		  (req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
		  req.session.user.roles.indexOf(ADMIN_ROLE)>=0));
		  
		if (!isAdmin) {
			req.push('error', 'You do not have permission to delete bonuses.');
			res.redirect('back');
			return;
		}
  		
		bonusProvider.remove(req.params.id, function(error, campaignId) {
			if (error) return next(error);
			
			req.flash('info', 'Successfully deleted _' + bonus.title + '_.');
			res.redirect('/bonuses/filter/' + campaignId);
		});
  	});    
  },
  
   // generic find route function, called by the controller when it doesn't know what to do
  
  findGetRoute: function (action){
	 switch(action) {
      case 'active':
        return ['/active/:parentId', false];
      	break;
      case 'recalculate':
        return ['/recalculate/:id', true];
      	break;
      default:
      	return null;
     }
  },
};
