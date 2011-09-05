 
 /**
 * Module dependencies.
 */
 
var express = require('express');
var form = require('connect-form');

var app = express.createServer(
			form({ keepExtensions: true })
		);

require('./mvc').boot(app);

app.listen(3000);
console.log('Express app started on port 3000');
