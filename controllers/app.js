
module.exports = {
  
  	// /
  
  index: function(req, res){
    res.render();
  },
  
  	// /about
  
  about: function(req, res){
    res.render();
  },
  
	// generic find route function, called by the controller when it doesn't know what to do
  
  findGetRoute: function(action){
	 switch(action) {
      case 'about':
        return ['about', false];
      	break;
      default:
      	return null;
     }
  },
};
