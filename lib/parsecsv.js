var fs = require('fs')
var sys = require('sys')

// hacked up version of this: http://blog.james-carr.org/2010/07/07/parsing-csv-files-with-nodejs/
module.exports = {
	parseCsvFile: function (fileName, callback) {
  		var stream = fs.createReadStream(fileName);
  		var iteration = 0, header = [], buffer = "";
  		var pattern = /(?:^|,)("(?:[^"]+)*"|[^,]*)/g;
  		
  		var records = [];
		
		stream.addListener('data', function (data) {
			buffer += data.toString();
			var parts = buffer.split('\n'); // \r\n?
			
			parts.forEach(function(d, i){      			
      			if(iteration++ == 0 && i == 0){
        			header = d.split(pattern);
      			} else {
        			var r = buildRecord(d);
        			records.push(r);
      			}
      			
      			if (i == parts.length-1) {
      				callback(null, records); // return records via callback
      			}
    		});
    		
    		buffer = parts[parts.length-1];
  		});

		function buildRecord(str){
			var record = {}
			
			str.split(pattern).forEach(function(value, index){
      			if(header[index] != '')
        			record[header[index].toLowerCase()] = value.replace(/"/g, '')
    		});
    		
    		return record;
  		}
	} // end parseCsvFile
};

