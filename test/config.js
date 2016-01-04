'use strict';

var
	merge = require('x-common').merge;

var generic = {
	hostname : '127.0.0.1',
	port :     38080,
	protocol:  'http',
	
	rewrite : {
		hostname : 'cxcscnode',
		port :     28080 // varnish port
	}
};

module.exports = {
	development : merge( {}, generic, {
		rewrite : {
			port : 38080 // no varnish locally
		}
	}),
	
	development_cienv: merge( {}, generic, {
		port : 58080
	}),
	
	test :       generic,
	
	production : generic
};
