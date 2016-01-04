'use strict';

var vows     = require('vows'),
	assert   = require('assert'),
	location = require('../location'),
	extend   = require('x-common').extend,
	merge    = require('x-common').merge,
	proxy    = require('x-proxy'),
	log      = require('x-log'),
	config   = require('x-configs')(__dirname+'/config.js'),
	suite    = vows.describe('location'),
	debug    = false; // true;

config = merge( {}, config, merge({},config.rewrite || {} ) ); // server config for rewrite overwrites server host/port if defined

var call = function(options/*host,location,target:{url},mount,url*/){
	return function(test){
		var
			self = this,
			req = {
				log     : function(){ return debug ? log : {}; },
				url     : options.url,
				server  : { config: config },
				headers : options.headers
			},
			res = {
				backend_headers : { Location: options.Location  },
				headers   : {} ,
				getHeader : function(name){ return this.headers[name]; },
				setHeader : extend(function F(name,value){  F.called.push(Array.prototype.slice.call(arguments)); this.headers[name]=value; },{called:[]})
			},
			next = function() { self.callback(req,res); };
		
		req.proxy = proxy(req,{ url: options.target.url }, options.mount);
		
		//debugger;
		test( req, res, next );
	};
};


// helpers to make tests clearer
var assert_location=function(location){
	return function(req,res){
		assert.equal(res.headers['Location'],location);
	};
};
var assert_location_called=function(location){
	return function(req,res){
		assert.equal(res.setHeader.called.length,1);
		assert.deepEqual(res.setHeader.called[0],['Location',location]);
	};
}

suite.addBatch({
	'test middleware': { topic:function(){ return location('backend_headers'); },
		'rewrite cms': { topic:call({ headers:{ host:'xnode:38080' }, url:'/mount/foo/?z=abc', target:{url:'http://www.x-x.io/mobile-portal'}, mount:'mount',
		                              Location : 'http://www.x-x.io/mobile-portal/foo/bar?x=1&y=2#abc' }),
			'url with mount':assert_location_called('http://xnode:38080/mount/foo/bar?x=1&y=2#abc')
		},
		'rewrite backend no mount': { topic:call({ headers:{ host:'xnode:38080' }, url:'/mount/foo/?z=abc', target:{url:'http://www.x-x.io/mobile-portal'},
		                                       Location : 'http://www.x-x.io/mobile-portal/foo/bar?x=1&y=2#abc' }),
			'no mount url':assert_location_called('http://xnode:38080/foo/bar?x=1&y=2#abc')
		},
		'rewrite backend no host': { topic:call({ headers:{ }, url:'/mount/foo/?z=abc', target:{url:'http://www.x-x.io/mobile-portal'},
		                                      Location : 'http://www.x-x.io/mobile-portal/foo/bar?x=1&y=2#abc' }),
			'server rewrite config based url':assert_location_called('http://'+config.hostname+(config.port?':'+config.port:'')+'/foo/bar?x=1&y=2#abc')
		},
		'rewrite backend trailing slash': { topic:call({ headers:{ host:'xnode:38080' }, url:'/mount/foo/?z=abc', target:{url:'http://www.x-x.io/mobile-portal'},
		                                             Location : 'http://www.x-x.io/mobile-portal/foo/bar/?x=1&y=2#abc' }),
			'trailing slash url':assert_location_called('http://xnode:38080/foo/bar/?x=1&y=2#abc')
		},
		'no rewrite backend external': { topic:call({ headers:{ host:'xnode:38080' }, url:'/mount/foo/?z=abc', target:{url:'http://www.x-x.io/mobile-portal'},
		                                          Location : 'http://www.x-x.io/home/foo/bar' }),
			'external backend jump':assert_location('http://www.x-x.io/home/foo/bar')
		},
		'rewrite backend with forwarded request session': {
			topic:call({
				headers : {
					host                     :'xnode:38080',
					'x-forwarded-host'       :'m.x-x.io proxy1:8080 proxy2',
					'x-x-forwarded-request' :'foo/;jsession=abrakadabra?x=1&y=2'
				},
				url:'/mount/foo/?x=1&y=2',
				target:{url:'http://www.x-x.io/mobile-portal'},
				mount:'mount',
				Location : 'http://www.x-x.io/mobile-portal/foo/bar;xsession=blablub?z=5#fragment'
			}),
			'url with external session id':assert_location_called('http://xnode:38080/mount/foo/bar;xsession=blablub?z=5#fragment')
		},
		'rewrite backend preserve url encoding': { topic:call({ headers:{ host:'xnode:38080' }, url:'/mount/foo/?z=abc', target:{url:'http://www.x-x.io/mobile-portal'}, mount:'mount',
		                                                    Location : 'http://www.x-x.io/mobile-portal/foo/%3Cbar/a/%3A%3A%3A/%5B%5B%5B/%25%25%25?%24=%26%26%26' }),
			'encoded url':assert_location_called('http://xnode:38080/mount/foo/%3Cbar/a/%3A%3A%3A/%5B%5B%5B/%25%25%25?%24=%26%26%26')
		},
		'rewrite a shop wicket app redirect containing a relative /.. component': { 
			topic:call({
				headers : {
					host : 'cxdevman:38080'
				},
				url      :'/shop/foo/?z=abc',
				target   : {url:'http://mucv64:8181/mshop'},
				mount    :'shop',
				Location : 'http://mucv64:8181/mshop/bal/../blub'
			}),
			'encoded url resolved, contains no .. ':assert_location_called('http://cxdevman:38080/shop/blub')
		}
	}
}).exportTo(module,{error:false});
