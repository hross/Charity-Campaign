var config = require('../config');

// instantiate team provider
var TeamProvider = require('../providers/team').TeamProvider;
var teamProvider = new TeamProvider(config.mongodb.host, config.mongodb.port);

// instantiate user provider
var UserProvider = require('../providers/user').UserProvider;
var userProvider = new UserProvider(config.mongodb.host, config.mongodb.port, config.ldap.url, config.ldap.userSearch);

// instantiate item provider
var ItemProvider = require('../providers/item').ItemProvider;
var itemProvider = new ItemProvider(config.mongodb.host, config.mongodb.port);

// instantiate campaign provider
var CampaignProvider = require('../providers/campaign').CampaignProvider;
var campaignProvider = new CampaignProvider(config.mongodb.host, config.mongodb.port);

var dateformat = require('../lib/dateformat'); // custom date tools
require('../lib/util.js'); // utility functions

var _ = require('underscore')._;
var async = require('async');


var TEAM_CAPTAIN_ROLE = config.roles.TEAM_CAPTAIN_ROLE;
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
		teamProvider.findAll(campaignId, function(error, teams) {
			if (error) return next(error);
			res.render(null, {locals: {teams: teams, campaignId: campaignId, isAdmin: isAdmin}});
		});
	} else {
		teamProvider.findAll(null, function(error, teams) {
			if (error) return next(error);
        	res.render(null, {locals: {teams: teams, campaignId: null, isAdmin: isAdmin}});
    	});
	}
  },

  // single display
  
  show: function(req, res, next){
  	var teamId = req.params.id;
  
  	var canJoin = (req.session.user && 
  		(!req.session.user.teams || (req.session.user.teams.length <= 0)
  		|| (req.session.user.teams.indexOf(teamId) < 0)));
  		
  	var canLeave = (req.session.user && 
  		(req.session.user.teams && (req.session.user.teams.indexOf(teamId) >= 0)));
  
    teamProvider.findById(req.params.id, function(error, team) {
    	if (error) return next(error);
    	
    	if (!team) {
    		req.flash('error', 'Cannot find this team.');
    		res.redirect('back');
    		return;
    	}
    	
		var isAdmin = (req.session.user && req.session.user.roles &&
			(req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + team.campaignId)>=0 ||
			req.session.user.roles.indexOf(TEAM_CAPTAIN_ROLE + teamId)>=0 ||
			req.session.user.roles.indexOf(ADMIN_ROLE)>=0));
    	
    	itemProvider.teamPoints(req.params.id, function(error, points, bonusPoints) {
    		if (error) return next(error);
    		
    		if (!points) points = 0;
    		if (points.substring) points = parseInt(points);
    		if (typeof points != "number") points = 0;
    		
    		itemProvider.findAll(req.params.id, null, function(error, items) {
    			if (error) return next(error);
    			
    			// format the dates for display
    			if (items) {
					for (var i = 0; i < items.length; i++) {
						items[i].created_at_format = dateformat.dateFormat(items[i].created_at, "dddd, mmmm d, yyyy HH:MM");
						items[i].updated_on_format = dateformat.dateFormat(items[i].updated_on, "dddd, mmmm d, yyyy HH:MM");
					}
    			}

    			userProvider.findByLogin(team.captain, function(error, teamCaptain) {
    				if (error) return next(error);
    				if (!teamCaptain) {
    					teamCaptain = {};
    				}
    				
    				userProvider.findByLogin(team.sponsor, function(error, teamSponsor) {
    					if (error) return next(error);
    					if (!teamSponsor) {
    						teamSponsor = {};
    					}
    					
    					userProvider.findByTeam(team.id, function(error, members) {
    						team.members = members;
    						
    						campaignProvider.findById(team.campaignId, function(error, campaign) {

    							// make user this campaign allows auto leave/join
    							canJoin = canJoin && campaign && campaign.allowjoins;
    							canLeave = canLeave && campaign && campaign.allowjoins;
    				
								res.render(null, {locals: {
									teamCaptain: teamCaptain, teamSponsor: teamSponsor, team: team, canJoin: canJoin, canLeave: canLeave, 
									points: points, items: items, campaignId: team.campaignId, isAdmin: isAdmin
								}});
							});
						});
    				
    				});
  				});
  			});
  		});
    });
  },
  
  // edit screen
  
  edit: function(req, res, next){
    teamProvider.findById(req.params.id, function(error, team) {
    	if (error) return next(error);
    	
    	if (!team) {
    		req.flash("Could not find that team.");
    		res.render(null, {locals:{team: null}});
    		return;
    	}
    	
    	var teamId = team.id;
		var isAdmin = (req.session.user && req.session.user.roles &&
			(req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + team.campaignId)>=0 ||
			req.session.user.roles.indexOf(TEAM_CAPTAIN_ROLE + teamId)>=0 ||
			req.session.user.roles.indexOf(ADMIN_ROLE)>=0));

		if (!isAdmin) {
			req.push('error', 'You do not have permission to edit this team.');
			res.redirect('back');
			return;
		}

		userProvider.findByLogin(team.captain, function(error, teamCaptain) {
    		if (error) return next(error);
    		if (!teamCaptain) {
    			teamCaptain = {};
    			teamCaptain.login = "";
    		}
    		
    		userProvider.findByLogin(team.sponsor, function(error, teamSponsor) {
				if (error) return next(error);
				if (!teamSponsor) {
					teamSponsor = {};
					teamSponsor.login = "";
				}
				
				userProvider.findByTeam(team.id, function(error, members) {
    				team.members = members;

    				res.render(null, {locals: {team: team, campaignId: team.campaignId, teamCaptain: teamCaptain, teamSponsor: teamSponsor, isAdmin: isAdmin}});
    			});
    		});
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
		req.push('error', 'You do not have permission to edit item types.');
		res.redirect('back');
		return;
	}
	
	res.render(null, {locals: {campaignId: campaignId}});
  },
  
  // handle create post
  
  create: function(req, res, next){
  	if (!req.session.user) {
  		req.flash('error', 'You must be logged in to create a team.');
  		res.redirect('back');
  		return;
  	}
  	
  	var campaignId = req.param("campaignId");
  	
  	var isAdmin = (req.session.user && req.session.user.roles &&
		  (req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
		  req.session.user.roles.indexOf(ADMIN_ROLE)>=0));
  	
  	if (!isAdmin) {
		req.push('error', 'You do not have permission to create teams.');
		res.redirect('back');
		return;
	}
  	
   	// whoever created this team is the captain
  	var captain = req.param('captain');
  	if (!captain) { captain = req.session.user.login; }
  	
  	var sponsor = req.param('sponsor');
  	if (!sponsor) sponsor = null;
  	
  	// load team members
  	var members = [];
  	// validate list of members
  	if(req.param('members_hidden') && req.param('members_hidden').length) {
  		members = req.param('members_hidden');
  	} else {
  		members = [captain];
  	}
  	
  	// add captain and sponsor if they don't exist
  	if (captain && (members.indexOf(captain) < 0)) {
  		members.push(captain);
  	}
  	
  	if (sponsor && (members.indexOf(sponsor) < 0)) {
  		members.push(sponsor);
  	}

	// now create the team
	teamProvider.save({
		name: req.param('name'),
		motto: req.param('motto'),
		campaignId: campaignId,
		captain: captain,
		sponsor: sponsor
	}, function (error, teams) {
		if (error) return next(error);
		team = teams[0];
		
		// add new users to teams
		userProvider.joinTeamByLogin(captain, function(error, captainUser) {
			userProvider.joinTeamByLogin(sponsor, function(error, sponsorUser) {
				// add a role to this user so we know they are the captain
				userProvider.addRoleByLogin(captain, TEAM_CAPTAIN_ROLE + team.id, function(error, user) {
					if (error) return next(error);
		
					res.redirect("/teams/filter/" + team.campaignId);
				});
			});
		});
	});
  },
  
  // update a team
  
  update: function(req, res, next){
  	var captain = req.param('captain');
  	var sponsor = req.param('sponsor');
  	var id = req.params.id;
  	var campaignId = req.params.campaignId;
  	
  	if (!id || !captain) {
  		req.flash('error', 'Invalid update parameters.');
  		res.redirect('back');
  		return;
  	}
    	
	var teamId = id;
	var isAdmin = (req.session.user && req.session.user.roles &&
		(req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
		req.session.user.roles.indexOf(TEAM_CAPTAIN_ROLE + teamId)>=0 ||
		req.session.user.roles.indexOf(ADMIN_ROLE)>=0));

	if (!isAdmin) {
		req.push('error', 'You do not have permission to edit this team.');
		res.redirect('back');
		return;
	}
  	
  	// load team members
  	var members = [];
  	// validate list of members
  	if(req.param('members_hidden') && req.param('members_hidden').length) {
  		members = req.param('members_hidden');
  	} else {
  		if (captain) {
  			members = [captain];
  		}
  	}
  	
  	// add captain if they don't exist
  	if (captain && (members.indexOf(captain) < 0)) {
  		members.push(captain);
  	}

  	if (sponsor && (members.indexOf(sponsor) < 0)) {
  		members.push(sponsor);
  	}
  	
  	// get old team info
  	teamProvider.findById(id, function(error, oldTeam) {
  		if (error) {
  			req.push('error', 'Could not find the team you are trying to join.');
  			res.redirect('back');
  			return;
  		}
  		
  		// find old team members
  		userProvider.findByTeam(id, function(error, users) {
  			var removeTeam = function(user, callback) {
				// strip team from this user
				userProvider.leaveTeam(user, oldTeam, function(error, user) {
					if (error) { callback(error); return; }
					
					callback(null, user);
				});
  			};
  		
  			var addTeam = function(login, callback) {
  				// add team to this user
				userProvider.joinTeamByLogin(login, oldTeam, function(error, user) {
					if (error) { callback(error); return; }
					
					callback(null, user);
				});
  			};
  			
  			var rmvs = _.select(users, function(user) { return !_.include(members, user.login); });
  			var adds = _.select(members, function(member){ return !_.any(users, function(user){user.login == member})}); //TODO: will this really properly detect users?
  			
  			async.forEach(adds, addTeam, function(error) {
  				async.forEach(rmvs, removeTeam, function(error) {
  					// adds and removes to user base are completed
  					// now do the rest of our team maintenance
  					
					// look up captain based on login
					userProvider.findByLogin(captain, function(error, user) {
						if (error) { return next(error); }
						
						if (!user) {
							req.flash('error', 'Could not find user: _'+ captain + '_.');
							res.redirect('back');
							return;
						}
						
						// remove role for old users, add for new user
						var sameCaptain = false;
				
						if (user.roles && user.roles.indexOf(TEAM_CAPTAIN_ROLE + id)>=0) {
							sameCaptain = true;
						}
					
						teamProvider.update({
							name: req.param('name'),
							motto: req.param('motto'),
							id: id,
							campaignId: req.param('campaignId'),
							captain: user.login,
							sponsor: sponsor,
						}, function(error, teams) {
							if (error) return next(error);
							team = teams[0];
							
							// now we need to update user roles if there is a different captain
							if (!sameCaptain) {
								// clear all captain roles
								userProvider.clearRole(TEAM_CAPTAIN_ROLE + id, function (error) {
									if (error) return next(error);
				
									// set a new captain
									userProvider.addRoleByLogin(team.captain, TEAM_CAPTAIN_ROLE + id, function(error) {
										req.flash('info', 'Successfully updated _' + team.name + '_.');
										res.redirect('/teams/show/' + team.id);
										return;		
									});
								});
							} else {
								req.flash('info', 'Successfully updated _' + team.name + '_.');
								res.redirect('/teams/show/' + team.id);
							}
							
						});
					});
  				});
  			});
  			
  		});
  		
  	});

  },
  
  // destroy the team
  
  destroy: function(req, res, next){
  	teamProvider.findById(req.params.id, function(error, team) {
  		if (error) return next(error);
  		
    	if (!team) {
    		req.flash('error', 'Cannot find team.');
    		res.redirect('back');
    		return;
    	}
  		
		var campaignId = team.campaignId;
		
		var isAdmin = (req.session.user && req.session.user.roles &&
			  (req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
			  req.session.user.roles.indexOf(ADMIN_ROLE)>=0));
		
		if (!isAdmin) {
			req.push('error', 'You do not have permission to delete teams.');
			res.redirect('back');
			return;
		}
  		
		teamProvider.remove(req.params.id, function(error, campaignId) {
			if (error) return next(error);
			
			userProvider.findByTeam(req.params.id, function(error, users) {
			
				var removeTeam = function(user, callback) {
					// strip team from this user
					userProvider.leaveTeam(user, oldTeam, function(error, user) {
						if (error) { callback(error); return; }
						
						callback(null, user);
					});
				};
				
				async.forEach(users, removeTeam, function(error) {
					req.flash('info', 'Successfully deleted _' + team.name + '_.');
					res.redirect('/teams/filter/' + campaignId);
				});
			});
		});
  	});    
  },
  
  // audit page

  audit: function(req, res, next){
  	var teamId = req.params.id;
  	var unverified = req.params.unverified && (req.params.unverified == 'true');

    teamProvider.findById(teamId, function(error, team) {
    	if (error) return next(error);
    	
    	if (!team) {
    		req.flash('error', 'Could not find team.');
    		res.redirect('back');
    		return;
    	}
    	
		var isAdmin = (req.session.user && req.session.user.roles &&
			(req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
			req.session.user.roles.indexOf(TEAM_CAPTAIN_ROLE + teamId)>=0 ||
			req.session.user.roles.indexOf(ADMIN_ROLE)>=0));
		
		if (!isAdmin) {
			req.flash('error', 'You do not have permission to audit this team.');
			res.redirect('back');
			return;
		}
		
		// find recent team items to display
		if (unverified) {
			console.log("unverified only");
			itemProvider.findByTeam(team.id, 1000, function(error, items) {
				if (error) return next(error);
				
				if (!items) items = [];
				
				// format the dates for display
				for (var i = 0; i < items.length; i++) {
					items[i].created_at_format = dateformat.dateFormat(items[i].created_at, "mm/dd/yyyy");
					items[i].updated_on_format = dateformat.dateFormat(items[i].updated_on, "mm/dd/yyyy");
				}
	
				res.render(null, {locals: {items: items, isAdmin: isAdmin, campaignId: campaignId, team: team}});
			});
		} else {
			itemProvider.findByTeam(team.id, 1000, function(error, items) {
				if (error) return next(error);
				
				if (!items) items = [];
				
				// format the dates for display
				for (var i = 0; i < items.length; i++) {
					items[i].created_at_format = dateformat.dateFormat(items[i].created_at, "mm/dd/yyyy");
					items[i].updated_on_format = dateformat.dateFormat(items[i].updated_on, "mm/dd/yyyy");
				}
	
				res.render(null, {locals: {items: items, isAdmin: isAdmin, campaignId: campaignId, team: team}});
			});
		}
    });
  },
  
  // generic find route function, called by the controller when it doesn't know what to do
  
  findGetRoute: function (action){
	 switch(action) {
      case 'audit':
        return ['/audit/:id/:unverified', true];
      	break;
      default:
      	return null;
     }
  },
};
