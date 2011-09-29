var config = require('../config');

// instantiate campaign provider
var CampaignProvider = require('../providers/campaign').CampaignProvider;
var campaignProvider = new CampaignProvider(config.mongodb.host, config.mongodb.port);

// instantiate bonus provider
var BonusProvider = require('../providers/bonus').BonusProvider;
var bonusProvider = new BonusProvider(config.mongodb.host, config.mongodb.port);

// instantiate itemtype provider
var ItemTypeProvider = require('../providers/itemtype').ItemTypeProvider;
var itemTypeProvider = new ItemTypeProvider(config.mongodb.host, config.mongodb.port);

// instantiate team provider
var TeamProvider = require('../providers/team').TeamProvider;
var teamProvider = new TeamProvider(config.mongodb.host, config.mongodb.port);

// instantiate item provider
var ItemProvider = require('../providers/item').ItemProvider;
var itemProvider = new ItemProvider(config.mongodb.host, config.mongodb.port);

// instantiate user provider
var UserProvider = require('../providers/user').UserProvider;
var userProvider = new UserProvider(config.mongodb.host, config.mongodb.port, config.ldap.url, config.ldap.userSearch);

var dateformat = require('../lib/dateformat'); // custom date tools

var async = require('async');

var CAMPAIGN_ADMIN_ROLE = config.roles.CAMPAIGN_ADMIN_ROLE;
var ADMIN_ROLE = config.roles.ADMIN_ROLE;

function compare_users(a,b) {
  if (a.points > b.points)
     return -1;
  if (a.points < b.points)
    return 1;
  return 0;
}

function compare_teams(a,b) {
  if (a.points > b.points)
     return -1;
  if (a.points < b.points)
    return 1;
  return 0;
}


module.exports = {
  
  // list
  
  index: function(req, res){

	var isAdmin = (req.session.user && req.session.user.roles && req.session.user.roles.indexOf(ADMIN_ROLE)>=0);
  
	campaignProvider.findAll(function(error, campaigns) {
        res.render(null, {locals: {campaigns: campaigns, isAdmin: isAdmin}});
    });
  },

  // single display
  
  show: function(req, res, next){
  	var campaignId = req.params.id;

    campaignProvider.findById(campaignId, function(error, campaign) {
    	if (error) return next(error);
    	
    	if (!campaign) {
    		req.flash('error', 'Could not find campaign.');
    		res.redirect('back');
    		return;
    	}
    	
		bonusProvider.findAll(campaign.id, function(error, bonuses) {
			if (error) return next(error);
			
			teamProvider.findAll(campaign.id, function(error, teams) {
				if (error) return next(error);
				
				// calculate team points for each team
				var calcpoints = function(team, callback) {
					// calculate team points and return
					itemProvider.itemTotals(team.id, -1, function(error, points, bonusPoints, quantity) {
						team.points = points;
						team.bonusPoints = bonusPoints;
						team.quantity = quantity;
						callback(null, team);
					});
				};
				
				async.map(teams, calcpoints, function(error, results) {
					if (error) return next(error);
					
					// sort the results by points
					results.sort(compare_teams);
					
					// added in case there are no admins
					if (!campaign.administrators) campaign.administrators = [];
				
					// convert date/times for display
    				campaign.start = dateformat.dateFormat(campaign.start, "dddd, mmmm d, yyyy");
    				campaign.end = dateformat.dateFormat(campaign.end, "dddd, mmmm d, yyyy");
    				
    				var isAdmin = (req.session.user && req.session.user.roles &&
    					(req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
    					req.session.user.roles.indexOf(ADMIN_ROLE)>=0));
    					
    				// find recent campaign items to display
    				itemProvider.findByCampaign(campaignId, false, 5, function(error, items) {
    					if (error) return next(error);
    					
    					if (!items) items = [];
    					
						// format the dates for display
						for (var i = 0; i < items.length; i++) {
							items[i].created_at_format = dateformat.dateFormat(items[i].created_at, "dddd, mmmm d, yyyy HH:MM");
							items[i].updated_on_format = dateformat.dateFormat(items[i].updated_on, "dddd, mmmm d, yyyy HH:MM");
						}

    			    	itemProvider.userPointTotals(campaignId, function(error, totals) {
    			    		if (error) return next(error);
    			    	
    						// sort the results by points
							totals.sort(compare_users);
							
							//TODO: we only want 5 users
							if (totals.length > 5) {
								totals.splice(4, totals.length-5);
							}
							
							// find the user info for each user in the point list
							var userInfo = function(info, callback) {
								userProvider.findById(info.created_by, function(error, user) {
									// construct user object with points and return
									if (user) {
										user.points = info.points;
										callback(error, user);
									} else {
										callback(null, null);
									}
								});
							};
							  
							async.map(totals, userInfo, function(error, users) {
								if (error) callback(error);
								
								// after everything is done we are happy
								res.render(null, {locals: {campaign: campaign, bonuses: bonuses,
									teams: results, campaignId: campaign.id, 
									isAdmin: isAdmin, items: items, users: users}});
							});
    					});
					});
				});
			});
		});
    });
  },
  
  
  // single display
  
  dashboard: function(req, res, next){
  	var campaignId = req.params.id;

    campaignProvider.findById(campaignId, function(error, campaign) {
    	if (error) return next(error);
    	
    	if (!campaign) {
    		req.flash('error', 'Could not find campaign.');
    		res.redirect('back');
    		return;
    	}
    	
    	var currentDate = new Date();
		bonusProvider.findActive(campaign.id, currentDate, function(error, bonuses) {
			if (error) return next(error);
			
			bonusProvider.findActiveSpot(campaign.id, currentDate, function(error, spotbonuses) {
				if (error) return next(error);
				
				bonuses = bonuses.concat(spotbonuses);
			
				var bonusdetails = function(bonus, callback) {
					itemTypeProvider.findById(bonus.type, function(error, itemType) {
						if (error) callback(error);
						
						// append itemtype to bonus for further processing
						bonus.itemType = itemType;
						
						callback(null, bonus); // return the bonus
					});
				};
				
				async.map(bonuses, bonusdetails, function(error, results) {
					// results contain bonuses + itemtypes
					bonuses = results;
				
					teamProvider.findAll(campaign.id, function(error, teams) {
						if (error) return next(error);
						
						// calculate team points for each team
						var teamInfo = function(team, callback) {
							// add membership property for this team
							team.isMember = (req.session.user && 
								(req.session.user.teams && (req.session.user.teams.indexOf(team.id) >= 0)));
							
							// calculate team points
							itemProvider.itemTotals(team.id, -1, function(error, points, bonusPoints, quantity) {
								team.points = points;
								team.bonusPoints = bonusPoints;
								
								// find last 20 team items to display
								itemProvider.findByTeam(team.id, 20, function(error, items) {
									if (items) {
										// format the dates for display
										for (var i = 0; i < items.length; i++) {
											items[i].created_at_format = dateformat.dateFormat(items[i].created_at, "mm.d.yyyy HH:MM");
											items[i].updated_on_format = dateformat.dateFormat(items[i].updated_on, "mm.d.yyyy HH:MM");
										}
									}
									team.items = items;
									
									callback(null, team);
								});
							});
						};
						
						async.map(teams, teamInfo, function(error, teams) {
							if (error) return next(error);
							
							//TODO: use underscore for this sort
							// sort the results by points
							teams.sort(compare_teams);
							
							// added in case there are no admins
							if (!campaign.administrators) campaign.administrators = [];
						
							// convert date/times for display
							campaign.start = dateformat.dateFormat(campaign.start, "dddd, mmmm d, yyyy");
							campaign.end = dateformat.dateFormat(campaign.end, "dddd, mmmm d, yyyy");
							
							var isAdmin = (req.session.user && req.session.user.roles &&
								(req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
								req.session.user.roles.indexOf(ADMIN_ROLE)>=0));
								
							// find last 20 recent campaign items to display
							itemProvider.findByUserCampaign(req.session.user.id, campaignId, 20, function(error, items) {
								if (error) return next(error);
								
								if (!items) items = [];
								
								// format the dates for display
								for (var i = 0; i < items.length; i++) {
									items[i].created_at_format = dateformat.dateFormat(items[i].created_at, "mm.d.yyyy HH:MM");
									items[i].updated_on_format = dateformat.dateFormat(items[i].updated_on, "mm.d.yyyy HH:MM");
								}
								
								itemTypeProvider.findAll(campaignId, function(error, itemTypes) {
									// for each item type, display counts
									var typeStats = function(itemtype, callback) {
										// get item stats
										itemProvider.itemTotals(-1, itemtype.id, function(error, totalPoints, totalBonus, totalQuantity) {
											if (error) { callback(error); return; }
											
											itemtype.totalPoints = totalPoints;
											itemtype.totalBonus = totalBonus;
											itemtype.totalQuantity = totalQuantity;
											
											callback(null, itemtype);
										});
									};
									
									async.map(itemTypes, typeStats, function(error, itemTypes) {
										if (error) return next(error);
									
										// after everything is done we are happy
										res.render(null, {locals: {campaign: campaign, bonuses: bonuses,
											teams: teams, campaignId: campaign.id, 
											isAdmin: isAdmin, items: items, itemTypes: itemTypes}});
									});
								}); // end find all item types
							}); // end find by user
						}); // end async map team calcs
					}); // end find teams
				}); // end map bonuses
			}); // end find spot bonuses
		}); // end find bonuses
    }); // end find campaign
  },
  
  // audit page

  audit: function(req, res, next){
  	var campaignId = req.params.id;
  	var unverified = req.params.unverified && (req.params.unverified == 'true');

    campaignProvider.findById(campaignId, function(error, campaign) {
    	if (error) return next(error);
    	
    	if (!campaign) {
    		req.flash('error', 'Could not find campaign.');
    		res.redirect('back');
    		return;
    	}
    	
    	// added in case there are no admins
		if (!campaign.administrators) campaign.administrators = [];

		var isAdmin = (req.session.user && req.session.user.roles &&
			(req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
			req.session.user.roles.indexOf(ADMIN_ROLE)>=0));
			
		if (!isAdmin) {
			req.flash('error', 'You do not have permission to audit this campaign.');
			res.redirect('back');
			return;
		}
		
		// find recent campaign items to display
		if (unverified) {
			console.log("unverified only");
			itemProvider.findByCampaignUnverified(campaignId, 1000, function(error, items) {
				if (error) return next(error);
				
				if (!items) items = [];
				
				// format the dates for display
				for (var i = 0; i < items.length; i++) {
					items[i].created_at_format = dateformat.dateFormat(items[i].created_at, "mm/dd/yyyy");
					items[i].updated_on_format = dateformat.dateFormat(items[i].updated_on, "mm/dd/yyyy");
				}
	
				res.render(null, {locals: {items: items, isAdmin: isAdmin, campaignId: campaignId, campaign: campaign, verified: false}});
			});
		} else {
			itemProvider.findAllByCampaign(campaignId, 1000, function(error, items) {
				if (error) return next(error);
				
				if (!items) items = [];
				
				// format the dates for display
				for (var i = 0; i < items.length; i++) {
					items[i].created_at_format = dateformat.dateFormat(items[i].created_at, "mm/dd/yyyy");
					items[i].updated_on_format = dateformat.dateFormat(items[i].updated_on, "mm/dd/yyyy");
				}
	
				res.render(null, {locals: {items: items, isAdmin: isAdmin, campaignId: campaignId, campaign: campaign, verified: true}});
			});
		}
    });
  },
  
  // edit screen
  
  edit: function(req, res, next){
  	var campaignId = req.params.id;
  	
	campaignProvider.findById(req.params.id, function(error, campaign) {
		if (error) return next(error);
		
		// added in case there are no admins
		if (!campaign.administrators) campaign.administrators = [];

		var isAdmin = (req.session.user && req.session.user.roles &&
			(req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
			req.session.user.roles.indexOf(ADMIN_ROLE)>=0));
			
		if (!isAdmin) {
			req.flash('error', 'You do not have permission to edit this campaign.');
			res.redirect('back');
			return;
		}	
		
        res.render(null, {locals: {campaign: campaign, campaignId: campaign.id, isAdmin: isAdmin}});
    });
  },
  
  // create screen
  
  add: function(req, res, next){
	var isAdmin = (req.session.user && req.session.user.roles &&
		req.session.user.roles.indexOf(ADMIN_ROLE)>=0);
	
	if (!isAdmin) {
		req.flash('error', 'You do not have permission to add campaigns.');
		res.redirect('back');
		return;
	}
		
	res.render(null);
  },
  
  // handle create post
  
  create: function(req, res, next){
	var isAdmin = (req.session.user && req.session.user.roles &&
		req.session.user.roles.indexOf(ADMIN_ROLE)>=0);
	
	if (!isAdmin) {
		req.flash('error', 'You do not have permission to do this.');
		res.redirect('back');
		return;
	}
  
  	// creating user is an administrator
  	var administrators = [req.session.user.login];
  	
    campaignProvider.save({
        title: req.param('title'),
        description: req.param('description'),
        start: new Date(req.param('start')),
		end: new Date(req.param('end')),
		administrators: administrators,
    }, function( error, campaigns) {
    	if (error) return next(error);
    	
    	var campaignId = campaigns[0].id;
    	
		// add role function based on login
		var addRole = function(login, callback) {
			console.log("adding role to user...");
			
			// add a role to this user so we know they are a campaign admin
			userProvider.addRoleByLogin(login, CAMPAIGN_ADMIN_ROLE + campaignId, function(error, user) {
				if (error) return next(error);
	
				callback(null, user);
			});
		};
	  
		// run all the operations at once
		async.map(campaigns[0].administrators, addRole, function(error, results) {
			if (error) callback(error);
			
			// after everything is done we are happy
			req.flash('info', 'Successfully created _' + campaigns[0].title + '_.');
			res.redirect("/campaigns");
		});
    });
  },
  
  // update an item
  
  update: function(req, res, next){
  	var administrators = [];
  	// validate list of admins
  	if(req.param('administrators_hidden') && req.param('administrators_hidden').length) {
  		administrators = req.param('administrators_hidden');
  	} else {
  		administrators = [req.session.user.login];
  	}
  	
  	var campaignId = req.params.id;
	var isAdmin = (req.session.user && req.session.user.roles &&
    			  (req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
    			  req.session.user.roles.indexOf(ADMIN_ROLE)>=0));
    			  
	if (!isAdmin) {
		req.flash('error', 'You do not have permission to update this campaign.');
		res.redirect('back');
		return;
	}
	
	var allowjoins = req.param('allowjoins') != undefined;
	var allowflag = req.param('allowflag') != undefined;
  
	campaignProvider.update({
        title: req.param('title'),
        description: req.param('description'),
        id: campaignId,
        start: new Date(req.param('start')),
		end: new Date(req.param('end')),
		administrators: administrators,
		allowflag: allowflag,
		allowjoins: allowjoins
    }, function( error, campaigns) {
    	if (error) return next(error);
    	
    	// now add roles for campaign administrators
    	// first clear all existing roles
    	userProvider.clearRole(CAMPAIGN_ADMIN_ROLE + campaignId, function (error) {
    	
    		// add role function based on login
    		var addRole = function(login, callback) {
				console.log("adding role to user...");
				
				// add a role to this user so we know they are a campaign admin
				userProvider.addRoleByLogin(login, CAMPAIGN_ADMIN_ROLE + campaignId, function(error, user) {
					if (error) return next(error);
		
					callback(null, user);
				});
			};
		  
		  	// run all the operations at once
			async.map(campaigns[0].administrators, addRole, function(error, results) {
				if (error) callback(error);
				
				// after everything is done we are happy
				req.flash('info', 'Successfully updated _' + campaigns[0].title + '_.');
				res.redirect('/campaigns/show/' + campaigns[0].id);
			});
    	});
		
    });
  },
  
  // destroy the campaign
  
  destroy: function(req, res, next){
  	var campaignId = req.params.id;
	var isAdmin = (req.session.user && req.session.user.roles &&
    			  (req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
    			  req.session.user.roles.indexOf(ADMIN_ROLE)>=0));
    			  
	if (!isAdmin) {
		req.flash('error', 'You do not have permission to do this.');
		res.redirect('back');
		return;
	}
  
	campaignProvider.findById(req.params.id, function(error, campaign) {
		if (error) return next(error);
		
		campaignProvider.remove(req.params.id, function( error, id) {
			if (error) return next(error);
			req.flash('info', 'Successfully deleted _' + campaign.title + '_.');
			res.redirect('/campaigns');
    	});
    });
  },
  
    // generic find route function, called by the controller when it doesn't know what to do
  
  findGetRoute: function (action){
	 switch(action) {
      case 'dashboard':
        return ['/dashboard/:id', true];
      	break;
      case 'audit':
        return ['/audit/:id/:unverified', true];
      	break;
      default:
      	return null;
     }
  },
};
