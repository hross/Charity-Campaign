var config = require('../config');

// instantiate itemtype provider
var ItemTypeProvider = require('../providers/itemtype').ItemTypeProvider;
var itemtypeProvider = new ItemTypeProvider(config.mongodb.host, config.mongodb.port);

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
		itemtypeProvider.findAll(campaignId, function(error, itemtypes) {
			if (error) return next(error);
			res.render(null, {locals: {itemtypes: itemtypes, campaignId: campaignId, isAdmin: isAdmin}});
		});
	} else {
		itemtypeProvider.findAll(null, function(error, itemtypes) {
			if (error) return next(error);
			var campaignId = null;
			
			if (itemtypes && itemtypes.count > 0) {
				campaignId = itemtypes[0].campaignId;
			}
			
        	res.render(null, {locals: {itemtypes: itemtypes, campaignId: campaignId, isAdmin: isAdmin}});
    	});
	}
  },

  // single display
  
  show: function(req, res, next){
    itemtypeProvider.findById(req.params.id, function(error, itemtype) {
    	if (!itemtype) {
    		req.flash('error', 'Cannot find item type.');
    		res.redirect('back');
    		return;
    	}
    
    	var campaignId = itemtype.campaignId;
    	
		var isAdmin = (req.session.user && req.session.user.roles &&
    			  (req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
    			  req.session.user.roles.indexOf(ADMIN_ROLE)>=0));
    
    	if (error) return next(error);
        res.render(null, {locals: {itemtype: itemtype, campaignId: campaignId, isAdmin: isAdmin}});
    });
  },
  
  // edit screen
  
  edit: function(req, res, next){
    itemtypeProvider.findById(req.params.id, function(error, itemtype) {
    	if (error) return next(error);
    	
    	if (itemtype.system) {
    	    req.flash("This bonus was created by the system and cannot be edited.");
    		res.redirect('back');
    		return;
    	}
    	
    	if (!itemtype) {
    		req.flash('error', 'Cannot find item type.');
    		res.redirect('back');
    		return;
    	}
    	
    	var campaignId = itemtype.campaignId;
    	
		var isAdmin = (req.session.user && req.session.user.roles &&
			  (req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
			  req.session.user.roles.indexOf(ADMIN_ROLE)>=0));
			  
		if (!isAdmin) {
			req.push('error', 'You do not have permission to edit item types.');
			res.redirect('back');
			return;
		}
    	
        res.render(null, {locals: {itemtype: itemtype, campaignId: itemtype.campaignId}});
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
  	var visible = req.param('visible') && (req.param('visible') == 'on');
  	var campaignId = req.param("campaignId");
  	
	var isAdmin = (req.session.user && req.session.user.roles &&
		  (req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
		  req.session.user.roles.indexOf(ADMIN_ROLE)>=0));
	
	if (!isAdmin) {
		req.push('error', 'You do not have permission to create item types.');
		res.redirect('back');
		return;
	}
  
	var points = 0;	
    if (req.param('points')) {
    	points = parseInt(req.param('points'));
    	if (isNaN(points)) points = 0;
    }
  
    itemtypeProvider.save({
        name: req.param('name'),
        description: req.param('description'),
        points: points,
        campaignId: campaignId,
        visible: visible
    }, function( error, docs) {
    	if (error) return next(error);
    	
		if (docs[0]) {
			res.redirect("/itemtypes/filter/" + docs[0].campaignId);
		} else {
			res.redirect('/itemtypes');
		}
    });
  },
  
  // update an item
  
  update: function(req, res, next){
  	var visible = req.param('visible') && (req.param('visible') == 'on');
  	var campaignId = req.param("campaignId");
  
  	var isAdmin = (req.session.user && req.session.user.roles &&
		  (req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
		  req.session.user.roles.indexOf(ADMIN_ROLE)>=0));
	
	if (!isAdmin) {
		req.push('error', 'You do not have permission to update item types.');
		res.redirect('back');
		return;
	}
  
	var points = 0;	
    if (req.param('points')) {
    	points = parseInt(req.param('points'));
    	if (isNaN(points)) points = 0;
    }
    
    itemtypeProvider.findById(req.params.id, function(error, itemtype) {
  		if (error) return next(error);
  		
    	if (!itemtype) {
    		req.flash('error', 'Cannot find item type.');
    		res.redirect('back');
    		return;
    	}
    	
    	if (itemtype.system) {
    	    req.flash("This item type was created by the system and cannot be edited.");
    		res.redirect('back');
    		return;
    	}
  
		itemtypeProvider.update({
			name: req.param('name'),
			description: req.param('description'),
			points: points,
			id: req.params.id,
			campaignId: campaignId,
			visible: visible
		}, function(error, itemtypes) {
			if (error) return next(error);
	
			req.flash('info', 'Successfully updated _' + itemtypes[0].name + '_.');
			res.redirect('/itemtypes/show/' + itemtypes[0].id);
		});
	});
  },
  
  // destroy the campaign
  
  destroy: function(req, res, next){
  	itemtypeProvider.findById(req.params.id, function(error, itemtype) {
  		if (error) return next(error);
  		
    	if (!itemtype) {
    		req.flash('error', 'Cannot find item type.');
    		res.redirect('back');
    		return;
    	}
    	
    	if (itemtype.system) {
    	    req.flash("This item type was created by the system and cannot be deleted.");
    		res.redirect('back');
    		return;
    	}
  		
    	var campaignId = itemtype.campaignId;
    	
		var isAdmin = (req.session.user && req.session.user.roles &&
			  (req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
			  req.session.user.roles.indexOf(ADMIN_ROLE)>=0));
			  
		if (!isAdmin) {
			req.push('error', 'You do not have permission to delete item types.');
			res.redirect('back');
			return;
		}
  		
		itemtypeProvider.remove(req.params.id, function(error, campaignId) {
			if (error) return next(error);
			
			req.flash('info', 'Successfully deleted _' + itemtype.name + '_.');
			res.redirect('/itemtypes/filter/' + campaignId);
		});
  	});    
  },
};
