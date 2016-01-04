'use strict';
/**
 * this middleware maps the Cookie header for requests and the Set-Cookie header for response
 * the mapping is defined by options
 */

var
	extend     = require('x-common').extend,
	merge      = require('x-common').merge,
	util_map   = require('./map'),
	property   = require('x-common').property,
	set_cookie = require('x-cookie').set_cookie,
	cookie     = require('x-cookie').cookie;

var M;
module.exports = extend( M={}, {
	middleware: function(index, extension ){
		
		return extend(function (options){
			
			options = options || {};
			options = merge({}, extension.options, { map: options.map ? merge.remove : [] }, options);
			
			var
				from = property(options.from),
				to   = property(options.to,true); // merge
				
			return extend(function F(req, res, next) {
				try{
					var
						log    = req.log ? req.log(__filename) : {},
						obj    = arguments[index],
						opts   = extend({},F.options,{log:log}),
						result = extension.map(from(obj) || {}, opts,req,res);
					
					to(obj,result);
					
					next && next();
					
				}catch(err) { // status code if defined in options.map
					next && next(err);
				}
			},{
				options: options
			});
		},extension);
	}
});

module.exports=extend(M,{ // Cookie mapper
	request:M.middleware(0,{
		map: function( headers, options, req){ // add cookies also from req.cookies, because previous pipelines may have added cookies there
			headers = headers || {};
			var
				cookies = merge(cookie.parse(headers.Cookie || headers.cookie),req.cookies || {}),
				new_cookies = {};
			extend( new_cookies, util_map( cookies, options) );
			return {'Cookie': cookie.serialize(new_cookies)};
		},
		
		options:{
			map: [{ // 'Cookie' Headers
				name  : { match: /(.*)/, replace: '$1' },
				value : { match: /(.*)/, replace: '$1' }
			}], // remove replace or use replace:false  to remove cookies
			from: 'headers',
			to:   'proxy.headers'
		}
	}),
	
	response:M.middleware(1,{ // Set-Cookie mapper
		map: extend(function F( headers, options ){ // note: response headers are case sensitive
			//debugger;
			headers = headers || {};
			var
				cookies = set_cookie.parse(headers['Set-Cookie'] || headers['set-cookie']), new_cookies = [],
				log     = options.log,
				map     = options.map,
				create  = options.create;
			
			if(map) for(var ci=0, cl = cookies.length; ci<cl; ci++ ){
				var
					cookie     = cookies[ci], new_cookie,
					matched    = false,
					keys, key, k, kl;
				
				// extending the normal name/value mapping
				for(var i=0, l=map.length; i<l && !matched; i++){
					var
						rule    = map[i],
						matches = util_map.matches.bind(util_map, cookie,rule),
						replace = util_map.replace.bind(util_map, cookie,rule),
						set     = F.set.bind(F,cookie,rule);
					
					matched = matches('name') && matches('value') && matches('Domain') && matches('Path');
					if(matched){
						try{
							               new_cookie = replace('name');
							if(new_cookie) new_cookie = replace('value', new_cookie);
							if(new_cookie){
								replace('Domain', new_cookie);
								replace('Path'  , new_cookie);
								set('Secure'    , new_cookie);
								set('HttpOnly'  , new_cookie);
								set('Max-Age'   , new_cookie);
								set('Expires'   , new_cookie);
								if(rule.Expires)    delete new_cookie.maxAge;
								if(rule['Max-Age']) delete new_cookie.expires;
							}
							
							if(new_cookie){new_cookies.push(new_cookie)};
						}
						finally {
							util_map.log(log, cookie, rule, new_cookie);
						}
					}
				}
			}
			
			if(create) for(var cri=0, crl=create.length; cri<crl; cri++){
				new_cookies.push(merge({},create[cri]));
			}
			return {'Set-Cookie': set_cookie.serialize(new_cookies)};
		},{
			set:function(data,rule,property,new_data){ // for date/boolean values (false means removal)
				new_data = new_data || {};
				
				if ( property in data ){
					new_data[property] = data[property];
				}
				if( property in rule ){
					if( rule[property] ){
						new_data[property] = rule[property];
					} else {
						delete new_data[property];
					}
				}
			}
		}),
		options:{
			map: [{ // Set-Cookie Headers
				name     : { match: /(.*)/, replace: '$1' },
				value    : { match: /(.*)/, replace: '$1' },
				'Domain' : { match: /(.*)/, replace: '$1' },
				'Path'   : { match: /(.*)/, replace: '$1' }
				/* optional 'Secure'   : true | false */
				/* optional 'HttpOnly' : true | false */
				/* optional 'Max-Age'  : seconds      */
				/*          'Expiry    : date as iso string see rfc */
				/* optional 'Comment'  : some string without ; , or ' ' */
			}],  // remove replace or use replace:false to remove set cookie
			from: 'proxy.headers',
			to:   'headers'
		}
	})
});
