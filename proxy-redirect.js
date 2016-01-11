'use strict';

var
	extend   = require('x-common').extend,
	location = require('./location');

var utils = function(res){
	return {
		response: {
			/**
			 * wrap the original redirect to accept relative urls
			 * and automatically produce absolute urls with http server port / complete path
			 */
			redirect : (function(original_redirect){
				return function( u, options ){
					var status=302;
					if(''+parseInt(u,10)===''+u){ // allow status / url ...
						status=u;u=options;options=arguments[2];
					}
					if( options && options.query ) u = add_query(req,u);
					original_redirect.call(this,status,location.absolutize(req,u));
				};
			})(res.redirect),
		}
	};
};

module.exports = function (req, res, next) {  // if x-wapcli exists it must match
	
	extend(res,utils(res).response);
	
	next && next();
};
