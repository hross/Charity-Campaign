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
    	bonus.start = dateformat.dateFormat(bonus.start, "dddd, mmmm d, yyyy HH:MM");
    	bonus.end = dateformat.dateFormat(bonus.end, "dddd, mmmm d, yyyy HH:MM");
    	
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
    
  	var isAdmin = (req.session.user && req.session.user.roles &&
	  (req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
	  req.session.user.roles.indexOf(ADMIN_ROLE)>=0));
	  
	if (!isAdmin) {
		req.push('error', 'You do not have permission to create bonuses.');
		res.redirect('back');
		return;
	}
	
  	itemTypeProvider.findById(req.param('type'), function(error, itemType) {
    	if (error) return next(error);
    	if (!itemType) {
    		req.flash('info', 'No item type specified!');
    		res.redirect('/bonuses/filter/' + req.param('campaignId'));
    		return;
    	}
  
  		var title = req.param('title');
		var	description = req.param('description');
		var	start = new Date(req.param('start'));
		var	end = new Date(req.param('end'));
		var	points = req.param('points');
		var	type = req.param("type");
    	
    	/*
    	// input validation here
    	try {
    		check(start, 'Start date is not a date').isDate();
    		check(end, 'End date is not a date.').isDate();
    		check(points, 'Points must be an integer.').isInt();
    	} catch (e) {
    		req.flash('error', e.message);
    		res.redirect('back');
    		return;
    	}*/
  
		bonusProvider.save({
			title: title,
			description: description,
			name: itemType.name,
			campaignId: campaignId,
			start: start,
			end: end,
			points: points,
			type: type
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
    
	var isAdmin = (req.session.user && req.session.user.roles &&
	  (req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
	  req.session.user.roles.indexOf(ADMIN_ROLE)>=0));
	  
	if (!isAdmin) {
		req.push('error', 'You do not have permission to update bonuses.');
		res.redirect('back');
		return;
	}
  
  	itemTypeProvider.findById(req.param('type'), function(error, itemType) {
    	if (error) return next(error);
    	if (!itemType) {
    		req.flash('info', 'No item type specified!');
    		res.redirect('/bonuses/filter/' + req.param('campaignId'));
    		return;
    	}
    	
    	var title = req.param('title');
		var	description = req.param('description');
		var	start = new Date(req.param('start'));
		var	end = new Date(req.param('end'));
		var	points = req.param('points');
		var	type = req.param("type");
    	
    	/*// input validation here
    	try {
    		check(start, 'Start date is not a date').isDate();
    		check(end, 'End date is not a date.').isDate();
    		check(points, 'Points must be an integer.').isInt();
    	} catch (e) {
    		req.flash('error', e.message);
    		res.redirect('back');
    		return;
    	}*/
  
		bonusProvider.update({
			title: title,
			description: description,
			name: itemType.name,
			id: req.params.id,
			campaignId: campaignId,
			start: start,
			end: end,
			points: points,
			type: type
		}, function(error, bonuses) {
			if (error) return next(error);
	
			req.flash('info', 'Successfully updated _' + bonuses[0].title + '_.');
			res.redirect('/bonuses/show/' + bonuses[0].id);
		});
	});
  },
  
  // destroy the campaign
  
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
      default:
      	return null;
     }
  },
};
