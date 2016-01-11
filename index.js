'use strict';

var extend = require('x-common').extend;

module.exports =extend(require('./proxy'),{
	forward    : require('./proxy-forward'),
	status     : require('./proxy-status')
	location   : require('./location'),
	relativize : require('./relativize2'),
	redirect   : require('./proxy-redirect'),
	map : {
		header : require('./map-header'),
		cookie : require('./map-cookie')
	}
});
