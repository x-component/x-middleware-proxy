'use strict';

var
	merge    = require('x-common').merge,
	property = require('x-common').property;

function middleware(code, rules) {
	
	code = '' + code;
	
	if (rules[code]){
		return rules[code];
	}
	
	if (code.length===1) {
		return null;
	}
	
	return middleware(code.substring(0, code.length-1), rules);
}

var M;

/*
 *  Call a middleware depending on the status code or error of the inner response.
 */
module.exports = function(rules, proxy_property) {
	
	proxy_property = proxy_property || 'proxy';
	
	var proxy = property(proxy_property);
	
	return function (req, res, next) {
		var log = req.log ? req.log(__filename) : {};
		
		var proxy_res = proxy(res);
		
		if(proxy_res && proxy_res.error ) {
			if (rules['error']) {
				rules['error'](proxy_res.error, req, res, next);
				return;
			}
			log.error("There was an error, but no errorhandler is defined. Invoking next.");
			next && next();
			return;
		}
		
		if (!proxy_res || !proxy_res.statusCode) {
			next && next();
			return;
		}
		
		var f=middleware(proxy_res.statusCode, rules);
		
		if(f) {
			f(req, res, next);
		} else {
			log.debug && log.debug("No middleware found for this status code found. Invoking next.");
			next && next();
		}
	};
};
