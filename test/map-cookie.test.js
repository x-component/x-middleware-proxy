'use strict';
/*
 * Test mapping cookie headers: cookie and set-cookie
 * Mapping includes name, value, path, domain, max-age, expires, httponly, secure
 */
var
	verbose = false,
	level   = 'info';

var
	vows      = require('vows'),
	assert    = require('assert'),
	merge     = require('x-common').merge,
	extend    = require('x-common').extend,
	composite = require('x-middleware-composite'),
	log       = require('x-log'),
	suite     = vows.describe('map-cookie');

log.console(verbose);
log.level = level;

var requestMiddleware = function(options) {
	return function() {
		return require('../map-cookie').request(options);
	};
};
var responseMiddleware = function(options) {
	return function() {
		return require('../map-cookie').response(options);
	};
};

var test = function(headers,use_response) {
	return function(middleware) {
		var
			self = this,
			res  = {
			},
			record_log = extend( function F(){
				F.called.push(Array.prototype.slice.call(arguments));
			},{called:[]}),
			req  = {
				log: extend(function F(){ return F;},{
					any   : record_log,
					debug : log.debug ? record_log : null,
					info  : log.info  ? record_log : null,
					warn  : log.warn  ? record_log : null,
					error : log.error ? record_log : null
				})
			};
		(use_response?res:req)[middleware.options.from]=headers;
		middleware( req, res, function(next_arg){
			self.callback(req,res,next_arg);
		});
	};
};
var test_request  = function(headers){ return test(headers,false); };
var test_response = function(headers){ return test(headers,true ); };

var assert_set_cookie_regexp = function(name,regexp){
	return function(req,res,next_arg) {
		// get 'set-cookie' values and enforce its an array
		var cookies = res.proxy_response_headers ? res.proxy_response_headers['Set-Cookie']: null;
		if(!cookies) assert(false, 'no cookies found');
		if(!Array.isArray(cookies))cookies=[cookies];
		
		// check if name and regexp are matched at least once
		var found = false;
		for(var i=0,l=cookies.length; i<l && !found; i++){
			found = ~cookies[i].indexOf(name+'=') && (!regexp || regexp.test(cookies[i]));
		}
		assert(found,'could not find cookie name:'+name+ (regexp ? ', matching:'+regexp : '')+'.');
	};
};

suite.addBatch({
	'map response set-cookie': { topic: responseMiddleware({
			map : [
				{ name: { match: /(.*)/i, replace: '$1'}, Path: { match: /^\/mx(.*)/,  replace: '/x$1' } },
				{ name: { match: /(.*)/i, replace: '$1'} }
			],
			from: 'headers',
			to:   'proxy_response_headers'
		}),
		'2 set cookie headers': { topic: test_response({
			'Set-Cookie': [
				'JSESSIONID=0DF2F29F285D277B5F2E07B2AADA271F; Path=/mx/; HttpOnly',
				'aBc="xYz"; Version=1; Comment="bla"; Domain=.x-x.io; Max-Age=0; Expires=Thu, 01-Jan-1970 00:00:10 GMT; Path=/'
			]
		}),
			'2 set-cookie' : function(req,res,next_arg) { var tmp; assert( (tmp=res.proxy_response_headers) &&  (tmp=tmp['Set-Cookie']) && tmp.length ===2 ); },
			'JSESSION and NOT /mx'                  : assert_set_cookie_regexp('JSESSIONID',/(?!\/mx)/),
			'JSESSION and /x'                       : assert_set_cookie_regexp('JSESSIONID',/\/x/),
			'aBc and Thu, 01-Jan-1970 00:00:10 GMT' : assert_set_cookie_regexp('aBc'       ,/Expires=Thu, 01\-Jan\-1970 00:00:10 GMT/),
			'next'                                  : function(req,res,next_arg) { assert.equal(next_arg, void 0 ); }
		}
	},
	'map response set-cookie replace path with function': { topic: responseMiddleware({
			map : [
				{
					name: { match: /(.*)/i, replace: '$1'},
					Path: {
						match: /^(\/.+)/,
						replace: function(m,path){
							return '/login';
						}
					}
				}
			],
			from: 'headers',
			to:   'proxy_response_headers'
		}),
		'with login app cookie': { topic: test_response({
			'Set-Cookie': [
				'JSESSIONID=A68FFB9779273BE48487767A526D9870; Path=/mlogin'
			]
		}),
			'Path is NOT /mlogin' : assert_set_cookie_regexp('JSESSIONID',/(?!\/mlogin)/),
			'Path is /login'      : assert_set_cookie_regexp('JSESSIONID',/(\/login)/)
		}
	}
});

suite.exportTo(module,{error:false});
