'use strict';
/**
 *
 */
var
	extend   = require('x-common').extend,
	merge    = require('x-common').merge,
	map      = require('./map'),
	property = require('x-common').property;

var M;
module.exports = extend( M={}, {
	middleware: function(index, default_options){
		
		return extend(function (options){
			options = options || {};
			options = merge({}, default_options, { map: options.map ? merge.remove : [] }, options);
			
			var
				from = property(options.from),
				to   = property(options.to);
				
			return extend(function F(req, res, next) {
				try {
					var
						log    = req.log ? req.log(__filename) : {},
						obj    = arguments[index],
						opts   = extend({},F.options,{log:log}),
						result = map(from(obj),opts);
					
					to(obj,result);
					next && next();
					
				} catch( err ){ // status code if defined in options.map
					next && next(err);
				}
			},{
				options: options
			});
		},{
			options: default_options
		});
	}
});

extend(M,{
	request:M.middleware(0,{ // 0 = req
		map: [{ name:{ match : /(.*)/, replace: '$1'}, value: {  match: /(.*)/, replace: '$1' } }], // remove replace or use replace:false  to remove header
		from: 'headers',
		to:   'proxy.headers'
	}),
	response:M.middleware(1,{ // 1 = res
		map: [{ name:{ match : /(.*)/, replace: '$1' }, value : { match: /(.*)/, replace: '$1' } }],  // remove replace or use replace:false  to remove header
		from: 'proxy.headers',
		to:   'headers'
	}),
	headers  : map
});
