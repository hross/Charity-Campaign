var config = require('../config');

// instantiate campaign provider
var CampaignProvider = require('../providers/campaign').CampaignProvider;
var campaignProvider = new CampaignProvider();

// instantiate item provider
var ItemProvider = require('../providers/item').ItemProvider;
var itemProvider = new ItemProvider();

// instantiate item type provider
var ItemTypeProvider = require('../providers/itemtype').ItemTypeProvider;
var itemTypeProvider = new ItemTypeProvider();

// instantiate office provider
var OfficeProvider = require('../providers/office').OfficeProvider;
var officeProvider = new OfficeProvider();

// instantiate team provider
var TeamProvider = require('../providers/team').TeamProvider;
var teamProvider = new TeamProvider();

// instantiate bonus provider
var BonusProvider = require('../providers/bonus').BonusProvider;
var bonusProvider = new BonusProvider();

// instantiate user provider
var UserProvider = require('../providers/user').UserProvider;
var userProvider = new UserProvider(config.ldap.url, config.ldap.userSearch);

var dateformat = require('../lib/dateformat'); // custom date tools
var parse = require('../lib/parsecsv'); // csv parsing

var async = require('async');
var _ = require('underscore')._;

var CAMPAIGN_ADMIN_ROLE = config.roles.CAMPAIGN_ADMIN_ROLE;
var ADMIN_ROLE = config.roles.ADMIN_ROLE;

module.exports = {
  
  // list
  
  index: function(req, res){
  	var teamId = req.params.parentId;
  	if (teamId) {
		itemProvider.findAll(teamId, 100, function(error, items) {
			if (error) return next(error);
			
			var campaignId = null;
			if (items && items.length > 0) {
				campaignId = items[0].campaignId;
			}
			
			var user = req.session.user;
			var isAdmin = (user && user.roles &&
				(user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
				user.roles.indexOf(ADMIN_ROLE)>=0));
					
				isAdmin = isAdmin || (user && user.teams && (user.teams.indexOf(teamId) >= 0));
			
			res.render(null, {locals: {items: items, teamId: teamId, campaignId: campaignId, isAdmin: isAdmin}});
		});
	} else {
		itemProvider.findAll(null, null, function(error, items) {
			if (error) return next(error);
        	res.render(null, {locals: {items: items, teamId: null}});
    	});
	}
  },

  // single display
  
  show: function(req, res, next){
    itemProvider.findById(req.params.id, function(error, item) {
    	if (error) return next(error);
    	
    	if (!item) {
    		req.flash('error', 'Could not find this item.');
    		res.redirect('back');
    		return;
    	}
    	
    	userProvider.findByLogin(item.created_by_login, function(error, created_user) {
    		if (error) return next(error);
    		
    		if (!created_user) created_user = {};
    		
    		teamProvider.findById(item.teamId, function(error, team) {
    			if (error) return next(error);
    			
    			var user = req.session.user;
				var isAdmin = (user && user.roles &&
					(user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + team.campaignId)>=0 ||
					user.roles.indexOf(ADMIN_ROLE)>=0));
				var teamId = item.teamId;
					
				isAdmin = isAdmin || (user && user.teams && (user.teams.indexOf(teamId) >= 0));
				
				item.created_at = dateformat.dateFormat(item.created_at, "dddd, mmmm d, yyyy HH:MM");
				
				campaignProvider.findById(item.campaignId, function (error, campaign) {
					if (error) return next(error);
					
					// create a list of all bonuses this is associated with
					if (!item.bonuses) item.bonuses = [];
					if (!item.winner) item.winner = [];
					item.bonuses = _.union(item.bonuses, item.winner);
					
					bonusProvider.findByIds(item.bonuses, function (error, bonuses) {
						if (error) return next(error);
					
						res.render(null, {locals: {item: item, user: created_user, bonuses: bonuses,
							teamId: item.teamId, campaignId: item.campaignId, isAdmin: isAdmin, 
							canFlag: (campaign && campaign.allowflag)}});
					});
				});
    		});
    	});
    });
  },

  
  // edit screen
  
  edit: function(req, res, next){
    itemProvider.findById(req.params.id, function(error, item) {
    	if (error) return next(error);
        
        var teamId = item.teamId;
		teamProvider.findById(teamId, function(error, team) {
			if (error) return next(error);
			
			if (!team || !team.campaignId) {
				res.render(null, null);
				return;
			}
			
			var user = req.session.user;
			var isAdmin = (req.session.user && req.session.user.roles &&
				(req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + team.campaignId)>=0 ||
				req.session.user.roles.indexOf(ADMIN_ROLE)>=0));
				
			// make sure this user can add to this team
			var isTeam = user.teams && (user.teams.indexOf(teamId) >= 0);
			if (!(isTeam || isAdmin)) {
				req.flash('error', 'You cannot edit an item on a team you are not a member of.');
				res.redirect('back');
				return;
			}
			
			itemTypeProvider.findAll(team.campaignId, function(error, itemTypes) {
				if (error) return next(error);
				
				officeProvider.findAll(team.campaignId, function(error, offices) {
					if (error) return next(error);
					
					var campaignId = 0;
					if (itemTypes && itemTypes.length > 0) {
						campaignId = itemTypes[0].campaignId;
					} else {
						req.flash('error', 'There do not appear to be any items to add to this campaign.');
						res.redirect('back');
						return;
					}
					
					// we made it, render item types for this team and campaign
					res.render(null, {locals: {item: item, itemTypes: itemTypes, offices: offices, teamId: item.teamId, campaignId: team.campaignId, isAdmin: isAdmin}});
				});
			});
		});
    });
  },
  
  // create screen
  
  add: function(req, res, next){
  	var teamId = req.params.parentId;
  	var user = req.session.user;
  	
  	if (!teamId || !user) {
  		req.flash('error', 'Unable to add an item. Invalid team or user.');
  		res.redirect('back');
  		return;
  	}
  	
  	teamProvider.findById(teamId, function(error, team) {
    	if (error) return next(error);
    	if (!team || !team.campaignId) {
			req.flash('error', 'Unable to add an item. Could not find your team.');
			res.redirect('back');
			return;
    	}
    	
		var isAdmin = (user && user.roles &&
			(user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + team.campaignId)>=0 ||
			user.roles.indexOf(ADMIN_ROLE)>=0));
			
		// make sure this user can add to this team
		var isTeam = user.teams && (user.teams.indexOf(teamId) >= 0);
		if (!(isTeam || isAdmin)) {
			req.flash('error', 'You cannot add an item to a team you are not a member of.');
			res.redirect('back');
			return;
		}
    	
    	itemTypeProvider.findAll(team.campaignId, function(error, itemTypes) {
			if (error) return next(error);
			
			officeProvider.findAll(team.campaignId, function(error, offices) {
				if (error) return next(error);
			
				// we made it, render item types for this team and campaign
				res.render(null, {locals: {teamId: teamId, itemTypes: itemTypes, offices: offices, campaignId: team.campaignId, isAdmin: isAdmin}});
			});
		});
    });
  },
  
  // handle create post
  
  create: function(req, res, next) {
    var type = req.param('type');
    var teamId = req.param('teamId');
    var user = req.session.user;
    
    itemTypeProvider.findById(type, function(error, itemType) {
    	if (error) return next(error);
    	
    	if (!itemType) {
    		req.flash('error', 'Could not find any item types.');
    		res.redirect('back');
    		return;
    	}
    	
    	teamProvider.findById(teamId, function(error, team) {
			var isAdmin = (user && user.roles &&
				(user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + team.campaignId)>=0 ||
				user.roles.indexOf(ADMIN_ROLE)>=0));
				
			// make sure this user can add to this team
			var isTeam = user.teams && (user.teams.indexOf(teamId) >= 0);
			if (!(isTeam || isAdmin)) {
				req.flash('error', 'You cannot add an item to a team you are not a member of.');
				res.redirect('back');
				return;
			}
			
			// invisible items are assumed to be admin items
			var admin = !itemType.visible;
			
			// find any associated bonus points
			bonusProvider.findTypeWithin(itemType.id, (new Date()), function(error, bonuses) {
				if (error) return next(error);
				
				ibonuses = []; // keep track of applied bonuses
				ibonusvalues = [];
				
				var bonusPoints = 0;
				if (bonuses) {
					for (var i=0; i<bonuses.length; i++) {
						bonusPoints += parseInt(bonuses[i].points);
						ibonuses.push(bonuses[i].id);
						var bi = {};
						bi[bonuses[i].id] = parseInt(bonuses[i].points);
						ibonusvalues.push(bi);
					}
				}
	
				// make points all bonus points if this an admin item
				var points = parseInt(itemType.points);
				if (admin) {
					bonusPoints += points;
					points = 0;
				}
				
				
				var office = req.param('office');
				
				var quantity = 0;	
				var q = req.param('quantity');
				var quantity = 0;	
				
				try {
					if (req.param('quantity')) {
						quantity = parseInt(req.param('quantity'));
						if (isNaN(quantity)) quantity = 0;
					}
				} catch (e) {
					quantity = 0;
				}
				
				if (0 == quantity) {
					req.flash('error', 'Quantity must be a number greater than 0.');
					res.redirect('back');
					return;
				}
	
				// count it
				itemProvider.save({
					type: type,
					name: itemType.name,
					points: points,
					bonus: bonusPoints,
					campaignId: team.campaignId,
					description: itemType.description,
					teamId: teamId,
					quantity: quantity,
					created_by: req.session.user.id,
					updated_by: req.session.user.login,
					created_by_login: req.session.user.login,
					admin: admin,
					office: office,
					bonuses: ibonuses,
					bonusvalues: ibonusvalues
				}, function(error, items) {
					if (error) return next(error);
					
					
					if (items[0]) {
						// do bonus calculations based on this item
						_calculateBonuses(items[0], req.session.user.login, req.session.user.id, function(error, errorMessage) {
							if (error) { return next(error); }
							if (errorMessage) { req.flash('error', errorMessage); }
							
							res.redirect("/items/show/" + items[0].id);
						});
					} else {
						res.redirect('/items');
					}
				});
			});
    	});
    });
  },
  
  // update an item
  
  update: function(req, res, next){
    var teamId = req.param('teamId');
    var campaignId = req.param('campaignId');
    var user = req.session.user;
  
    itemTypeProvider.findById(req.param('type'), function(error, itemType) {
    	if (error) return next(error);
    	
    	if (!itemType) {
    		req.flash('info', 'No item type specified!');
    		res.redirect('back');
    		return;
    	}
    	
    	var isAdmin = (user && user.roles &&
			(user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
			user.roles.indexOf(ADMIN_ROLE)>=0));
			
		// make sure this user can add to this team
		var isTeam = user.teams && (user.teams.indexOf(teamId) >= 0);
		if (!(isTeam || isAdmin)) {
			req.flash('error', 'You cannot add an item to a team you are not a member of.');
			res.redirect('back');
			return;
		}
		
		var id = req.params.id;
    	
    	var flagged = req.param('flagged') != undefined;
    	var verified = req.param('verified') != undefined;
    	var admin = req.param('admin') != undefined;
    	
    	var quantity = 0;
    	
    	try {
			if (req.param('quantity')) {
				quantity = parseInt(req.param('quantity'));
				if (isNaN(quantity)) quantity = 0;
			}
		} catch (e) {
			quantity = 0;
		}
		
		if (0 == quantity) {
			req.flash('error', 'Quantity must be a number greater than 0.');
			res.redirect('back');
			return;
		}
			
    	var office = req.param('office');
    	
    	itemProvider.findById(id, function(error, oldItem) {
    		if (error) return next(error);
    		
    		if (!oldItem) {
    			req.flash('error', 'Could not find original item to update.');
				res.redirect('back');
				return;
    		}
    		
    		var item = {};
			item.type = itemType.id;
			item.id = id;
			item.teamId = oldItem.teamId;
			item.campaignId = oldItem.campaignId;
			item.quantity = req.param('quantity');
			item.name = itemType.name;
			item.points = parseInt(itemType.points);
			item.description = itemType.description;
			item.updated_by = req.session.user.login;
			item.flagged = flagged;
			item.office = office;
			
			if (!oldItem.flagged) {
				item.flagged_by = req.session.user.login;
			}
			
			if (!oldItem.verified) {
				item.verified_by = req.session.user.login;
			}
			
			if (isAdmin) {
				item.verified = verified;
				item.admin = admin;
			} else {
				item.verified = oldItem.verified;
				item.admin = oldItem.admin;
			}
			
			// find any associated bonus points and calculate bonus from original creation date
    		bonusProvider.findTypeWithin(oldItem.type, oldItem.created_at, function(error, bonuses) {
				if (error) return next(error);
				
				// keep track of applied bonuses
				item.bonuses = []; 
				item.bonusvalues = [];
			
				var bonusPoints = 0;
				if (bonuses) {
					for (var i=0; i<bonuses.length; i++) {
						bonusPoints += parseInt(bonuses[i].points);
						item.bonuses.push(bonuses[i].id);
						var bi = {};
    					bi[bonuses[i].id] = parseInt(bonuses[i].points);
    					item.bonusvalues.push(bi);
					}
				}
				
				// make points all bonus points if this an admin item
				if (admin) {
					bonusPoints += item.points;
					item.points = 0;
				}
			
				item.bonus = bonusPoints;
				
				itemProvider.update(item, function(error, items) {
					if (error) return next(error);
			
					req.flash('info', 'Successfully updated _' + items[0].name + '_.');
					res.redirect('/items/show/' + items[0].id);
				});
			});
    	});
    });
  },
  
  // destroy the campaign
  
  destroy: function(req, res, next){
  	var user = req.session.user;
  	
  	itemProvider.findById(req.params.id, function(error, item) {
  		if (error) return next(error);
  		
    	if (!item) {
    		req.flash('info', 'No item type specified!');
    		res.redirect('back');
    		return;
    	}
  		
  		var teamId = item.teamId;
  		var isAdmin = (user && user.roles &&
			(user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + item.campaignId)>=0 ||
			user.roles.indexOf(ADMIN_ROLE)>=0));
			
		// make sure this user can add to this team
		var isTeam = user.teams && (user.teams.indexOf(teamId) >= 0);
		
		if (!(isTeam || isAdmin)) {
			req.flash('error', 'You cannot delete an item from a team you are not a member of.');
			res.redirect('back');
			return;
		}
  		
		itemProvider.remove(req.params.id, function(error, teamId) {
			if (error) return next(error);
			
			req.flash('info', 'Successfully deleted _' + item.name + '_.');
			res.redirect('/items/filter/' + teamId);
		});
  	});    
  },
  
  // verify the item and return true/false
  
  verify: function(req, res, next) {
  	var user = req.session.user;

	var results = [];
	

	itemProvider.findById(req.params.id, function(error, item) {
	  	var isAdmin = (user && user.roles &&
			(user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + item.campaignId)>=0 ||
			user.roles.indexOf(ADMIN_ROLE)>=0));
			
		if (!isAdmin) { 
			res.send({verified: false});
			return;
		}
		
		itemProvider.verify(user.login, req.params.id, function(error, users) {
			if (error) {
				res.send({verified: false});
				return;
			}
			
			itemProvider.findById(req.params.id, function(error, item) {
				if (!item) {
					res.send({verified: false});
					return;
				}
				res.send({verified: (!error && item && item.verified), verified_by: item.verified_by});
			});
		});
  	});
  },
  
  // flag the item and return true/false
  
  flag: function(req, res, next) {
  	var user = req.session.user;

	var results = [];
	

	itemProvider.findById(req.params.id, function(error, item) {
		
		itemProvider.flag(user.login, req.params.id, function(error, users) {
			if (error) {
				res.send({verified: false});
				return;
			}
			
			itemProvider.findById(req.params.id, function(error, item) {
				if (!item) {
					res.send({flagged: false});
					return;
				}
				res.send({flagged: (!error && item && item.flagged), flagged_by: item.flagged_by});
			});
		});
  	});
  },
  
    // display upload item list form
  csv: function(req, res, next){
  	var isAdmin = (req.session.user && req.session.user.roles &&
		req.session.user.roles.indexOf(ADMIN_ROLE)>=0);
	
	if (!isAdmin) {
		req.flash('error', "You are not an administrator.");
		res.redirect('back');
		return;
	}
		
	res.render(null, {locals: {isAdmin: isAdmin}});
  },
  
  // upload a list of users as a CSV
  upload: function(req, res, next){
  
  	console.log("Starting upload...");
  
	var isAdmin = (req.session.user && req.session.user.roles &&
		req.session.user.roles.indexOf(ADMIN_ROLE)>=0);
	
	if (!isAdmin) {
		req.flash('error', "You are not an administrator.");
		res.redirect('back');
		return;
	}

	req.form.complete(function(error, fields, files){
    	if (error) { next(error); return; }
    	
    	if (files.itemList) {
      		console.log('Uploaded %s to %s', files.itemList.filename, files.itemList.path);
      		
      		// try to parse the csv file and return some user records
			parse.parseCsvFile(files.itemList.path, function(error, records) {
				if (error) { 		
					req.flash('error', "Could not parse uploaded file.");
					res.redirect('back'); 
				}

				var createItem = function(record, callback) {
					console.log("Creating item from CSV record...");
					console.log(record);
					
					console.log(record.typeid);
					// create item from the record
					itemTypeProvider.findById(record.typeid, function(error, itemType) {
						if (error) return next(error);
						
						if (!itemType) {
							callback(null, null);
							return;
						}
						
						// invisible items are assumed to be admin items
						var admin = !itemType.visible;
						
						// find any associated bonus points
						bonusProvider.findTypeWithin(itemType.id, (new Date()), function(error, bonuses) {
							if (error) return next(error);
							
							ibonuses = []; // keep track of applied bonuses
						
							var bonusPoints = 0;
							if (bonuses) {
								for (var i=0; i<bonuses.length; i++) {
									bonusPoints += parseInt(bonuses[i].points);
									ibonuses.push(bonuses[i].id);
									var bi = {};
									bi[bonuses[i].id] = parseInt(bonuses[i].points);
									ibonusvalues.push(bi);
								}
							}
							
							// make points all bonus points if this an admin item
							var points = parseInt(itemType.points);
							if (admin) {
								bonusPoints += points;
								points = 0;
							}
				
							// get user info
							userProvider.findByLogin(record.login, function(error, user) {
								itemProvider.save({
									type: itemType.id,
									name: itemType.name,
									points: points,
									bonus: bonusPoints,
									campaignId: bonus.campaignId,
									description: itemType.description,
									teamId: record.teamid + '',
									quantity: record.quantity,
									created_by: user.id,
									updated_by: user.login,
									created_by_login: user.login,
									admin: admin,
									office: record.office,
									bonuses: ibonuses,
									bonusvalues: ibonusvalues
								}, function(error, items) {
									if (error) return next(error);
									
									if (items[0]) {
										callback(null, items[0]);
									} else {
										callback(null, null);
									}
								});
							});
						});
					});
				};
				
				async.map(records, createItem, function(error, items){
					req.flash('info', 'Successfully created these items: ' + items);
					res.redirect('back');
					return;
				});
    		}); // end parseCsvFile
    	} else {
    		req.flash('info', "Could not create any items.");
      		res.redirect('back');
    	}
  	});
  },
  
  // generic find route function, called by the controller when it doesn't know what to do
  
  findGetRoute: function (action){
	 switch(action) {
      case 'csv':
      	return ['/csv', true];
      default:
      	return null;
     }
  },
  
  findJsonRoute: function (action) {
  	switch(action) {
      case 'verify':
        return ['/verify/:id', true];
      	break;
      case 'flag':
        return ['/flag/:id', true];
      	break;
      default:
      	return null;
      }
  },
  
  findPostRoute: function (action){
	 switch(action) {
      case 'upload':
      	return ['/upload', true];
      	break;
      default:
      	return null;
     }
  },  
};

function _calculateBonuses(item, login, userId, callback) {
	// find the team
	teamProvider.findById(item.teamId, function(error, team) {
		if (error) { callback(error); return; }

		if (!team) { callback(null, "Could not find team for this item."); return; }
		
		// find any active bonuses
		bonusProvider.findActiveSpot(item.campaignId, item.created_at, function(error, bonuses) {
			if (error) { callback(error); return; }
			if (!bonuses || bonuses.length <= 0) { callback(null, null); return; } // no bonuses to calculate
		
			itemTypeProvider.findSystemBonus(function(error, sysItemType) {
				var checkBonus = function(bonus, callback) {
					if (!bonus.winners) bonus.winners = []; // make sure this is an array
				
					// get stats related to this bonus
					itemProvider.itemTotals(team.id, bonus.type, function(error, points, bonusPoints, quantity) {
						if (error) { callback(error); }
						
						// which total do we need?
						var total = quantity;
						if ('points' == bonus.pointsoritems) {
							total = points;
						}
						
						// we passed the bonus threshold and this team didn't already win
						if ((total >= bonus.total) && !_.contains(bonus.winners, team.id)) {
						
							// this team is now a winner
							bonus.winners.push(team.id);
							
							// check to see if we need to close this bonus out
							if ((bonus.end && (item.created_at > bonus.end)) || (bonus.winners.length == bonus.numteams)) {
								bonus.completed = true;
								bonus.completed_on = new Date();
							} else {
								bonus.completed = false;
							}
							
							// update the bonus stats, since we found a match
							bonusProvider.update(bonus, function(error, ubonus) {
								if (error) { callback(error); return; }
	
								// update the item with some information about the bonus
								if (!item.winner) item.winner = [];
								item.winner.push(bonus.id);
								
								itemProvider.update(item, function(error, uitem) {
									if (error) { callback(error); return; }
									
									var bi = {};
									bi[bonus.id] = parseInt(bonus.spotpoints);
									
									// add a bonus point item for the winning team
									itemProvider.save({
										type: sysItemType.id, // system bonus point type
										name: sysItemType.name,
										points: 0,
										bonus: bonus.spotpoints,
										campaignId: bonus.campaignId,
										description: "Bonus Points for " + bonus.title + " Bonus",
										teamId: item.teamId,
										quantity: 1,
										created_by: userId,
										updated_by:	login,
										created_by_login: login,
										admin: true,
										office: "",
										bonuses: [bonus.id],
										bonusvalues: [bi]
									}, function(error, items) {
										if (error) callback(error);
										
										callback(null, bonus);
									}); // end item update
								}); // end original item update
							});
						} else {
							callback(null, bonus); // we are done
						}
					});
				};
				
				// for any of the active bonuses we need to determine if this item crosses the threshold
				async.map(bonuses, checkBonus, function(error, bonuses) {
					if (error) { callback(error); }
					
					// we made it!
					callback(null, null);
				});
			}); // end find system item type
		});
	});
}
