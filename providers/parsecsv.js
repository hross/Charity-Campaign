var fs = require('fs')
var sys = require('sys')

module.exports = {
	parseCsvFile: function (fileName, callback) {
  		var stream = fs.createReadStream(fileName)
  		var iteration = 0, header = [], buffer = ""
  		var pattern = /(?:^|,)("(?:[^"]+)*"|[^,]*)/g
		
		stream.addListener('data', function(data) {
			buffer += data.toString()
			var parts = buffer.split('\r\n')
			
			parts.forEach(function(d, i){
      			if(i == parts.length-1) return
      			
      			if(iteration++ == 0 && i == 0){
        			header = d.split(pattern)
      			} else {
        			callback(buildRecord(d))
      			}
    		})
    		
    		buffer = parts[parts.length-1]
  		})

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

