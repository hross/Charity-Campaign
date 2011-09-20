var config = require('../config');

// instantiate item provider
var ItemProvider = require('../providers/item').ItemProvider;
var itemProvider = new ItemProvider(config.mongodb.host, config.mongodb.port);

// instantiate item type provider
var ItemTypeProvider = require('../providers/itemtype').ItemTypeProvider;
var itemTypeProvider = new ItemTypeProvider(config.mongodb.host, config.mongodb.port);

// instantiate office provider
var OfficeProvider = require('../providers/office').OfficeProvider;
var officeProvider = new OfficeProvider(config.mongodb.host, config.mongodb.port);

// instantiate team provider
var TeamProvider = require('../providers/team').TeamProvider;
var teamProvider = new TeamProvider(config.mongodb.host, config.mongodb.port);

// instantiate bonus provider
var BonusProvider = require('../providers/bonus').BonusProvider;
var bonusProvider = new BonusProvider(config.mongodb.host, config.mongodb.port);

// instantiate user provider
var UserProvider = require('../providers/user').UserProvider;
var userProvider = new UserProvider(config.mongodb.host, config.mongodb.port, config.ldap.url, config.ldap.userSearch);

var dateformat = require('../lib/dateformat'); // custom date tools

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
    	
    	userProvider.findById(item.created_by, function(error, created_user) {
    		if (error) return next(error);
    		
    		if (!created_user) created_user = {};
    		
    		teamProvider.findById(item.teamId, function(error, team) {
    			var user = req.session.user;
				var isAdmin = (user && user.roles &&
					(user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + team.campaignId)>=0 ||
					user.roles.indexOf(ADMIN_ROLE)>=0));
				var teamId = item.teamId;
					
				isAdmin = isAdmin || (user && user.teams && (user.teams.indexOf(teamId) >= 0));
				
				item.created_at = dateformat.dateFormat(item.created_at, "dddd, mmmm d, yyyy HH:MM");
				
				res.render(null, {locals: {item: item, user: created_user, teamId: item.teamId, campaignId: item.campaignId, isAdmin: isAdmin}});
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
    	
    	var isAdmin = (user && user.roles &&
			(user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + itemType.campaignId)>=0 ||
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
    	
    		var bonusPoints = 0;
    		if (bonuses) {
    			for (var i=0; i<bonuses.length; i++) {
    				bonusPoints += parseInt(bonuses[i].points);
    			}
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
				points: parseInt(itemType.points),
				bonus: bonusPoints,
				campaignId: itemType.campaignId,
				description: itemType.description,
				teamId: teamId,
				quantity: quantity,
				created_by: req.session.user.id,
				updated_by: req.session.user.login,
				created_by_login: req.session.user.login,
				admin: admin,
				office: office
			}, function(error, items) {
				if (error) return next(error);
				
				if (items[0]) {
					res.redirect("/items/show/" + items[0].id);
				} else {
					res.redirect('/items');
				}
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

    	var bonus = 0;	
    	if (req.param('bonus')) {
    		bonus = parseInt(req.param('bonus'));
    		if (isNaN(bonus)) bonus = 0;
    	}
    	
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
			item.bonus = bonus;
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
			
			itemProvider.update(item, function(error, items) {
				if (error) return next(error);
		
				req.flash('info', 'Successfully updated _' + items[0].name + '_.');
				res.redirect('/items/show/' + items[0].id);
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
};
