var config = require('../config');
var ADMIN_ROLE = config.roles.ADMIN_ROLE;

module.exports = {
  
  	// /
  
  index: function(req, res){
    res.render();
  },
  
  	// /about
  
  about: function(req, res){
    res.render();
  },
  
  // render application admin options
  
  admin: function(req, res) {
  	var isAdmin = (req.session.user && req.session.user.roles &&
		req.session.user.roles.indexOf(ADMIN_ROLE)>=0);
		
	if (!isAdmin) {
		req.flash('error', "You are not an administrator.");
		res.redirect('back');
		return;
	}
	
	res.render(null, {locals: {isAdmin: isAdmin}});
  },
  
	// generic find route function, called by the controller when it doesn't know what to do
  
  findGetRoute: function(action){
	 switch(action) {
      case 'about':
        return ['about', false];
      	break;
      case 'admin':
      	return ['admin', true];
      	break;
      default:
      	return null;
     }
  },
};
