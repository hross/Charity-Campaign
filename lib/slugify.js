var _slugify_strip_re = /[^\w\s-]/g;
var _slugify_hyphenate_re = /[-\s]+/g;

module.exports = {

	/* generate a slugified string from a normal one */
	slugify: function(s) {
	  s = s.replace(_slugify_strip_re, '').trim().toLowerCase();
	  s = s.replace(_slugify_hyphenate_re, '-');
	  return s;
	},
	
	/* zero pad a number */
	zero_pad: function(num) {
		return ((num.toString()).length == 1) ? "0" + num : num.toString();
	},
	
	/* generate a unique url id */
	url_id: function(title) {
		var date = new Date();
		var date_string = date.getFullYear() + '-' +
			this.zero_pad(date.getMonth() + 1) + '-' +
			this.zero_pad(date.getDate()) + "-" + 
			this.zero_pad(date.getHours()) + ":" + 
			this.zero_pad(date.getMinutes()) + ":" +
			this.zero_pad(date.getSeconds());
			return date_string + '-' + this.slugify(title);
	}
};
