var config = require('../config');

// instantiate office provider
var OfficeProvider = require('../providers/office').OfficeProvider;
var officeProvider = new OfficeProvider(config.mongodb.dbname, config.mongodb.host, config.mongodb.port);

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
		officeProvider.findAll(campaignId, function(error, offices) {
			if (error) return next(error);
			res.render(null, {locals: {offices: offices, campaignId: campaignId, isAdmin: isAdmin}});
		});
	} else {
		officeProvider.findAll(null, function(error, offices) {
			if (error) return next(error);
			var campaignId = null;
			
			if (offices && offices.count > 0) {
				campaignId = offices[0].campaignId;
			}
			
        	res.render(null, {locals: {offices: offices, campaignId: campaignId, isAdmin: isAdmin}});
    	});
	}
  },

  // single display
  
  show: function(req, res, next){
    officeProvider.findById(req.params.id, function(error, office) {
    	if (!office) {
    		req.flash('error', 'Cannot find item type.');
    		res.redirect('back');
    		return;
    	}
    
    	var campaignId = office.campaignId;
    	
		var isAdmin = (req.session.user && req.session.user.roles &&
    			  (req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
    			  req.session.user.roles.indexOf(ADMIN_ROLE)>=0));
    
    	if (error) return next(error);
        res.render(null, {locals: {office: office, campaignId: campaignId, isAdmin: isAdmin}});
    });
  },
  
  // edit screen
  
  edit: function(req, res, next){
    officeProvider.findById(req.params.id, function(error, office) {
    	if (error) return next(error);
    	
    	if (!office) {
    		req.flash('error', 'Cannot find item type.');
    		res.redirect('back');
    		return;
    	}
    	
    	var campaignId = office.campaignId;
    	
		var isAdmin = (req.session.user && req.session.user.roles &&
			  (req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
			  req.session.user.roles.indexOf(ADMIN_ROLE)>=0));
			  
		if (!isAdmin) {
			req.push('error', 'You do not have permission to edit item types.');
			res.redirect('back');
			return;
		}
    	
        res.render(null, {locals: {office: office, campaignId: office.campaignId}});
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
  
    officeProvider.save({
        name: req.param('name'),
        description: req.param('description'),
        campaignId: campaignId
    }, function( error, docs) {
    	if (error) return next(error);
    	
		if (docs[0]) {
			res.redirect("/offices/filter/" + docs[0].campaignId);
		} else {
			res.redirect('/offices');
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
  
    officeProvider.update({
        name: req.param('name'),
        description: req.param('description'),
        id: req.params.id,
        campaignId: campaignId,
    }, function(error, offices) {
    	if (error) return next(error);

		req.flash('info', 'Successfully updated _' + offices[0].name + '_.');
		res.redirect('/offices/show/' + offices[0].id);
    });
  },
  
  // destroy the campaign
  
  destroy: function(req, res, next){
  	officeProvider.findById(req.params.id, function(error, office) {
  		if (error) return next(error);
  		
    	if (!office) {
    		req.flash('error', 'Cannot find item type.');
    		res.redirect('back');
    		return;
    	}
  		
    	var campaignId = office.campaignId;
    	
		var isAdmin = (req.session.user && req.session.user.roles &&
			  (req.session.user.roles.indexOf(CAMPAIGN_ADMIN_ROLE + campaignId)>=0 ||
			  req.session.user.roles.indexOf(ADMIN_ROLE)>=0));
			  
		if (!isAdmin) {
			req.push('error', 'You do not have permission to delete item types.');
			res.redirect('back');
			return;
		}
  		
		officeProvider.remove(req.params.id, function(error, campaignId) {
			if (error) return next(error);
			
			req.flash('info', 'Successfully deleted _' + office.name + '_.');
			res.redirect('/offices/filter/' + campaignId);
		});
  	});    
  },
};
