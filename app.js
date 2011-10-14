 
 /**
 * Module dependencies.
 */
 
var express = require('express');
var form = require('connect-form');

var app = express.createServer(
			form({ keepExtensions: true })
		);

require('./mvc').boot(app);

var port = process.env.PORT || 3000;
app.listen(port);
console.log('Express app started on port ' + port);
