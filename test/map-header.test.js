'use strict';
/*
 * Test mapping of header name / value pairs
 */
var
	verbose = false,
	level   = 'info';

var
	vows   = require('vows'),
	assert = require('assert'),
	merge  = require('x-common').merge,
	extend = require('x-common').extend,
	log    = require('x-log'),
	suite  = vows.describe('map-header');

log.console(verbose);
log.level = level;

var requestMiddleware = function(options) {
	return function() {
		return require('../map-header').request(options);
	};
};
var responseMiddleware = function(options) {
	return function() {
		return require('../map-header').response(options);
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
		
		middleware( req, res, function(next_arg){ self.callback(req,res,next_arg); });
	};
};
var test_request  = function(headers){ return test(headers,false); };
var test_response = function(headers){ return test(headers,true ); };


suite.addBatch({
	'map request headers': { topic: requestMiddleware({
			map:[
				{ name: { match : /X-A-(.*)/, replace: 'X_A_$1_A' }, value: {  match: /(.*)/, replace: '$1'  } },
				{ name: { match : /X-B-(.*)/, replace: 'X_B_$1_B' }, value: {  match: /(.*)/, replace: 'B_$1_B' } },
				{ name: { match : /X-C-(.*)/, replace: false  }},
				{ name: { match : /X-C-(.*)/, replace: 'X_C_$1_C'}},
				{ name: { match : /X-D-(.*)/, replace: 'X_D_$1_D'}},
				{ name: { match : /(set-.*)/, replace: '$1' },       value: {  match: /(.*)/, replace: '$1'  } },
				{ name: { match : /(.*)/    , replace: '$1'}} // pass all others
			],
			from: 'headers',
			to:   'proxy_request_headers'
		}),
		'header X-A-hello:value1': { topic: test_request({'X-A-hello':'value1'}),
			'replaced name' : function(req) { assert('X_A_hello_A' in req.proxy_request_headers); },
			'same value'    : function(req) { assert.equal(req.headers['X-A-hello'],req.proxy_request_headers['X_A_hello_A']); }
		},
		'header X-B-hello:value2': { topic: test_request({'X-B-hello':'value2'}),
			'replaced name' : function(req) { assert('X_B_hello_B' in req.proxy_request_headers); },
			'replaced value': function(req) { assert.equal('B_'+req.headers['X-B-hello']+'_B',req.proxy_request_headers['X_B_hello_B']); }
		},
		'headers  X-A-hello:value1,X-C-hello:value3': { topic: test_request({'X-A-hello':'value1','X-C-hello':'value3','XXX':'YYY'}),
			'removed X-C-hello:'      : function(req) { assert(!( 'X_C_hello_C' in req.proxy_request_headers) && !( 'X-C-hello' in req.proxy_request_headers)); },
			'replaced X-A-hello name' : function(req) { assert('X_A_hello_A' in req.proxy_request_headers); },
			'copied XXX name'         : function(req) { assert('XXX' in req.proxy_request_headers); },
			'copied XXX value YYY'    : function(req) { assert('YYY'===req.proxy_request_headers['XXX']); }
		},
		'header sonderzeichen %&:*§"!?:?!"§*:&%': { topic: test_request({'%&:*§"!?':'?!"§*:&%'}),
			'copied %&:*§"!? name'           : function(req) { assert('%&:*§"!?' in req.proxy_request_headers); },
			'copied %&:*§"!? value ?!"§*:&%' : function(req) { assert('?!"§*:&%'===req.proxy_request_headers['%&:*§"!?']); }
		},
		'header set-cookie:[array]' : {topic: test_request({'set-cookie':['cookie1=12231','cookie2=13341','cookie3=14451']}),
			'copied name'                : function(req) {
				assert('set-cookie' in req.proxy_request_headers);},
			'value is an array'          : function(req) {assert(Array.isArray(req.proxy_request_headers['set-cookie']));},
			'value has 3 array elements' : function(req) {
				assert(req.proxy_request_headers['set-cookie'].length && req.proxy_request_headers['set-cookie'].length === 3);}
		}
	},
	'create request headers': { topic: requestMiddleware({
			create: [
				{ name  : 'X-E-new'   , value: 'new_value' }  // create a new header
			],
			from: 'headers',
			to:   'proxy_request_headers'
		}),
		'header create': { topic: test_request({}),
			'new name' : function(req) { assert('X-E-new' in req.proxy_request_headers); },
			'new value': function(req) { assert.equal('new_value',req.proxy_request_headers['X-E-new']); }
		},
		'header overwrite': { topic: test_request({'X-E-new':'old_value'}),
			'new name' : function(req) { assert('X-E-new' in req.proxy_request_headers); },
			'new value': function(req) { assert.equal('new_value',req.proxy_request_headers['X-E-new']); }
		}
	},
	'handle header in request black/white listing logic' : {topic: requestMiddleware({
			map:[
				{ name: { match : /(X-WAPCLI)/, replace: '$1' }, value: { match: /[a-z]+/ }, status : 401 , log: { level: 'error', message:'SECURITY not passed blacklist' } }, // black list
				{ name: { match : /(X-WAPCLI)/, replace: '$1' }, value: { match: /^(49\d{5,30})$/, replace:'$1' } }, // white list
				{ name: { match : /(X-WAPCLI)/ }, status: 500, log: { level:'error' } }, // fallback if not passed white list
				{ name: { match : /(.*)/       , replace: '$1'}} // pass all others
			],
			from: 'headers',
			to:   'proxy_request_headers'
		}),
		'header 4911abc black-listed': { topic: test_request({'X-WAPCLI':'4911abc'}),
			'not in new header': function(req,res,next_arg) { assert( !req.proxy_request_headers || !('X-WAPCLI' in req.proxy_request_headers)); },
			'next'             : function(req,res,next_arg) { assert.equal(next_arg, 401 ); }
//			'log called'       : function(req,res,next_arg){ assert(req.log.any.called.length > 0); }
		},
		'header 49123456 white-listed': { topic: test_request({'X-WAPCLI':'49123456'}),
			'in new headers': function(req) { assert( 'X-WAPCLI' in req.proxy_request_headers); },
			'value in new headers': function(req,res,next_arg) { assert.equal('49123456',req.proxy_request_headers['X-WAPCLI']); },
			'next'                : function(req,res,next_arg) { assert.equal(next_arg, void 0 ); },
			
			                        // log level 'info', never called, 'debug' then always called but just once
			'log not called'      : function(req,res,next_arg) { assert(req.log.any.called.length === (log.level === 'debug'?1:0)); }
		},
		'header 4912 not white-listed': { topic: test_request({'X-WAPCLI':'4912'}),
			'not in new header' : function(req) { assert( !req.proxy_request_headers || !('X-WAPCLI' in req.proxy_request_headers)); },
			'next'              : function(req,res,next_arg) { assert.equal(next_arg, 500); }
//			'log called'        : function(req){ assert(req.log.any.called.length > 0); }
		}
	},
	'map response headers': { topic: responseMiddleware({
			map:[
				{ name: { match : /X-A-(.*)/, replace: 'X_A_$1_A' }, value: {  match: /(.*)/, replace: '$1'  } },
				{ name: { match : /X-B-(.*)/, replace: 'X_B_$1_B' }, value: {  match: /(.*)/, replace: 'B_$1_B' } },
				{ name: { match : /X-C-(.*)/, replace: false      }},
				{ name: { match : /X-C-(.*)/, replace: 'X_C_$1_C' }},
				{ name: { match : /X-D-(.*)/, replace: 'X_D_$1_D' }},
				{ name: { match : /(set-.*)/, replace: '$1' },       value: {  match: /(.*)/, replace: '$1'  } },
				{ name: { match : /(.*)/    , replace: '$1'       }} // pass all others
			],
			from: 'proxy_response_headers',
			to:   'response_headers'
		}),
		'header X-A-hello:value1': { topic: test_response({'X-A-hello':'value1'}),
			'replaced name' : function(req,res) { assert('X_A_hello_A' in res.response_headers); },
			'same value'    : function(req,res) { assert.equal(res.proxy_response_headers['X-A-hello'],res.response_headers['X_A_hello_A']); }
		},
		'header X-B-hello:value2': { topic: test_response({'X-B-hello':'value2'}),
			'replaced name' : function(req,res) { assert('X_B_hello_B' in res.response_headers); },
			'replaced value': function(req,res) { assert.equal('B_'+res.proxy_response_headers['X-B-hello']+'_B',res.response_headers['X_B_hello_B']); }
		},
		'headers  X-A-hello:value1,X-C-hello:value3': { topic: test_response({'X-A-hello':'value1','X-C-hello':'value3','XXX':'YYY'}),
			'removed X-C-hello:'      : function(req,res) { assert(!( 'X_C_hello_C' in res.response_headers) && !( 'X-C-hello' in res.response_headers)); },
			'replaced X-A-hello name' : function(req,res) { assert('X_A_hello_A' in res.response_headers); },
			'copied XXX name'         : function(req,res) { assert('XXX' in res.response_headers); },
			'copied XXX value YYY'    : function(req,res) { assert('YYY'===res.response_headers['XXX']); }
		},
		'header sonderzeichen %&:*§"!?:?!"§*:&%': { topic: test_response({'%&:*§"!?':'?!"§*:&%'}),
			'copied %&:*§"!? name'           : function(req,res) { assert('%&:*§"!?' in res.response_headers); },
			'copied %&:*§"!? value ?!"§*:&%' : function(req,res) { assert('?!"§*:&%'===res.response_headers['%&:*§"!?']); }
		},
		'header set-cookie:[array]' : {topic: test_response({'set-cookie':['cookie1=12231','cookie2=13341','cookie3=14451']}),
			'copied name'                : function(req,res) {assert('set-cookie' in res.response_headers);},
			'value is an array'          : function(req,res) {assert(Array.isArray(res.response_headers['set-cookie']));},
			'value has 3 array elements' : function(req,res) {assert(res.response_headers['set-cookie'].length && res.response_headers['set-cookie'].length === 3);}
		}
	},
	'create response headers': { topic: responseMiddleware({
			create: [
				{ name  : 'X-E-new'   , value: 'new_value' }  // create a new header
			],
			from: 'proxy_response_headers',
			to:   'response_headers'
		}),
		'header create': { topic: test_response({}),
			'new name' : function(req,res) { assert('X-E-new' in res.response_headers); },
			'new value': function(req,res) { assert.equal('new_value',res.response_headers['X-E-new']); }
		},
		'header overwrite': { topic: test_response({'X-E-new':'old_value'}),
			'new name' : function(req,res) { assert('X-E-new' in res.response_headers); },
			'new value': function(req,res) { assert.equal('new_value',res.response_headers['X-E-new']); }
		}
	},
	'copy request cookie header': { topic:requestMiddleware({
			map : [
				{ name:  { match : /Cookie/i,            replace: 'Cookie'}},
				{
				  name : { match : /(.*)/,               replace: '$1' },
				  value: { match : /(.*)/,               replace: '$1' }
				}
			],
			from: 'headers',
			to:   'proxy_request_headers'
		}),
		'header cookie': { topic: test_request({
				'cookie' : 'JSESSIONID=92166FAF0594AD8E75ABD7441DC3E659; XONLINEID=55ED8A3E8ED697F94D593C6701298B04; xonline=P=37074+16480+48231+14103+6698+62652+44993+465+56245+38531+6431+15259+46354+6988+16871+12680+12515+56077+54176+59757+61942+3706+55882+10827+11607+51039+53833+11066&L=38665+3562+39790+48689+39342+63491+15465+58948&A=13485+7601+18477+4113&S=38665+3562+39790+48689+39342+63491+15465+58948&T=63595+40348+33148+61555+64294+37167+21689+25055+33595+19160+36571+46429&X=41782+59805+42314+15228&U=28113+25848+55754+12973&D=38171+63181+37661+19137+33440+13562+51374+26837+38819+1676+56036+19896&C=23282+110+65012+13508+13485+7601+18477+4113&K=36720+44620+42941+54475&N=13485+7601+18477+4113&M=13485+7601+18477+4113&Z=MCwCFCzW8rEmvtLLkTHsKq1RgVd3bFdxAhQTqXFKvn9jYaS79QHwpUXbOmMW9Q==; XX=YY;'
			}),
			'copied to Cookie name' : function(req) { assert('Cookie' in req.proxy_request_headers); },
			'same value'            : function(req) { assert.equal(req.headers['cookie'],req.proxy_request_headers['Cookie']); }
		}
	}
});

suite.exportTo(module,{error:false});
