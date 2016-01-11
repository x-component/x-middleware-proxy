'use strict';
/*
 * proxy.test
 *
 * tests for proxy.js
 *
 * operation with ./util/node_modules/vows/bin/vows middleware/test/proxy.test.js
 *
 */
var
	verbose = false,
	level   = 'debug';

process.env.NODE_ENV = 'development_cienv';

var
	vows    = require('vows'),
	assert  = require('assert'),
	log     = require('x-log'),
	express = require('express'),
	merge   = require('x-common').merge,
	bool    = require('x-common').bool,
	request = require('request'),
	http    = require('http'),
	port    = 30010;

log.console(verbose);
log.level = level;

// application as target behind the proxy
var app = express();
app.get(/^\/app/, [ require('cookie-parser')(), function (req, res, next) {
	if (req.query.timeout) {
		setTimeout((function () {
			res.send('<html><body>enforcing a timeout on client by long running response</body></html>');
		}), req.query.timeout || 2000);
	}
	else if (req.query.status) {
		if (req.query.status === '302' || req.query.status === '303') {
			res.redirect(parseInt(req.query.status,10),'http://localhost:'+ port + req.path + '?redirect=' + req.query.status);
			return;
		}
		res.statusCode = req.query.status;
		res.send(req.query.status);
	}
	else if (req.query.gif){
		res.type('gif');
		res.status(200);
		res.send(new Buffer([
			0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00,
			0x80, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x2c,
			0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02,
			0x02, 0x44, 0x01, 0x00, 0x3b]));
	}
	else if (req.query['set-cookie'] ){
		var cookie_args=[req.query['set-cookie'],req.query.value ];
		var options = {};
		if( 'domain'   in req.query ) options.domain   = req.query.domain;
		if( 'path'     in req.query ) options.path     = req.query.path;
		if( 'maxAge'   in req.query ) options.maxAge   = parseInt(req.query.maxAge,10)*1000;
		if( 'httpOnly' in req.query ) options.httpOnly = bool(req.query.httpOnly);
		if( 'secure'   in req.query ) options.secure   = bool(req.query.secure);
		
		cookie_args.push(options);
		debugger;
		res.cookie.apply(res,cookie_args);
		
		// and simulate a typical session Set-Cookie: JSESSIONID=DA0356D57B713CE892C6F95D474D053E; Path=/xshop; HttpOnly
		res.cookie('JSESSIONID','6D57B713CE892C6F95D474D053E', {path:'/app', httpOnly:true });
		res.send('<html><body><pre>'+JSON.stringify(cookie_args)+'</pre></body></html>');
	} else if (req.query.cookie ){
		var exists = req.query.cookie in req.cookies;
		var cookie_value = exists ? req.cookies[req.query.cookie] : 'UNKNOWN COOKIE';
		res.send(cookie_value);
	} else {
		res.send('<html><body>[Internal URL: ' + req.url + ']</body></html>');
	}
}]);


// a proxy route forwarding to the above target (itself)

app.all(/^\/proxy/, [
	//require('cookie-parser')(),
	require('../proxy-redirect'),
	function (req, res, next) {
		req.headers.host='localhost:'+port+'/app';
		
		if (req.query.connectionerr){
			req.headers.host='localhost:65535/app'; // a non exisiting target
		}
		
		req.url = req.url.replace('/proxy','');
		
		next && next();
	},
	
	require('../proxy-forward').request(),
	require('../map-header').request({
		map : [
			{ name: { match : /Host/i,              replace : false }},
			{ name: { match : /Content-Length/i,    replace : false }},
			{ name: { match : /Transfer-Encoding/i, replace : false }},
			{ name: { match : /Accept.*/i,          replace : false }},
			{ name: { match : /Cookie/i,            copy    : false }},
			{ name: { match : /(.*)/,               replace : '$1'  }, value: {  match: /(.*)/, replace: '$1' } }
		],
		create : [
			{ name: 'x-renderer'  , value : 'x-x' },
			{ name: 'Accept-Charset' , value : 'utf-8;q=0.9,*;q=0.8"' }
		]
	}),
	
	require('../map-cookie').request({
		map : [
			{ name: { match : /(x.*)/i, replace : '$1'} } // pass only x.* cookies in this test like xuser
		]
	}),
	
	require('../proxy')({
		mount: '/proxy',
		client: { request : { timeout: 100 } }
	}),
	
	require('../proxy-status')({
		5: function (req, res, next) {
			res.error = 500;
			next && next(500);
			return;
		},
		error: function (error, req, res, next) {
			res.error = 503;
			next && next(503);
		}
	}),
	require('../map-header').response({
		map : [
			{ name: { match : /Content-Length/i,    replace : false }},
			{ name: { match : /Date/i,              replace : false }},
			{ name: { match : /Connection/i,        replace : false }},
			{ name: { match : /Transfer-Encoding/i, replace : false }},
			{ name: { match : /Location/i,          copy    : false }}, // done by location middleware
			{ name: { match : /Set-Cookie/i,        copy    : false }}, // done by map-cookie
			{ name: { match : /(.*)/,               replace : '$1'  },     value: {  match: /(.*)/, replace: '$1' } }
		],
		create : [
			{ name: 'x-x-powered-by' , value : '1' }
		]
	}),
	require('../map-cookie').response({
		map : [
			{ name: { match : /(.*)/i, replace : '$1'}, Path: { match: /^\/xshop(.*)/, replace: '/shop$1' } }, // rewrite cookie path
			{ name: { match : /(.*)/i, replace : '$1'} }
		]
	}),
	require('../proxy-forward').response(),
	require('../location')('proxy.headers'),
	function (req, res, next) {
		if (res.body) {
			res.send(res.body);
			return;
		}
		if(res.getHeader('location')){
			res.end();
			return;
		}
		next && next();
	},
	function (error, req, res, next) {
		if (error) {
			if (typeof(error) === 'number'){
				res.statusCode=error;
			}
			res.send('Error: ' + error);
			return;
		}
		next && next();
	}
]);

var call = function(url,headers){
	return function () { request({url: 'http://localhost:'+port+url, headers : headers || {}, followRedirect: false}, this.callback); };
};

var assert_status = function(status){
	return function (err, res, body) {  assert.equal(res.statusCode, status); }
};

var assert_set_cookie = function(res,parts){
	var cs = res.headers['set-cookie'];
	assert(cs);
	if(!Array.isArray(cs)) cs=[cs];
	for(var i=0,found=false,l=cs.length;i<l && !found; i++){
		var c=cs[i];
		for(var pi=0,pl=parts.length;pi<pl;pi++){
			found = found || !!(~c.indexOf(parts[pi]));
		}
	}
	assert(found);
};

var suite=vows.describe('proxy test');
suite.addBatch({
	'target-app': {
		topic: function() {
			var self   = this;
			var server = http.createServer(app);
			server.listen(port);
			server.once('listening', function(err) {
				self.callback(server);
			});
		},
		teardown:function(server){
			server.close(this.callback);
		},
		'proxied app gets a status parameter 402': { topic: call('/app?status=402'),
			'proxy target returns 402': assert_status(402)
		},
		'proxied app returns 200': { topic: call('/proxy/index.html'),
			'proxy returns 200': assert_status(200)
		},
		'proxied app returns 500': { topic: call('/proxy/index.html?status=500'),
			'proxy returns 500': assert_status(500)
		},
		'proxied app does not answer in time': { topic: call('/proxy/index2.html?timeout=200'),
			'proxy returns 503': assert_status(503)
		},
		'proxied app could not be connected': { topic: call('/proxy/index2.html?connectionerr=true'),
			'proxy returns 503': assert_status(503)
		},
		'proxied app sends 302': { topic: call('/proxy/index.html?status=302'),
			'proxy returns 302': assert_status(302),
			'proxy returned location contains proxy':  function (err, res, body) { assert(res.headers.location && ~res.headers.location.indexOf('/proxy/')); }
		},
		'proxied app sends 303': { topic: call('/proxy/index.html?status=303'),
			'proxy returns 303': assert_status(303),
			'proxy returned location contains proxy':  function (err, res, body) { assert(res.headers.location && ~res.headers.location.indexOf('/proxy/')); }
		},
		'proxied app returns image': { topic: call('/proxy/index.html?gif=true'),
			'proxy returns 200': assert_status(200),
			'proxy returned content type contains image/jpeg': function (err, res) { debugger; assert(res.headers['content-type'] && ~res.headers['content-type'].indexOf('image/gif')); }
		},
		'proxied app returns 404': { topic: call('/proxy/index.html?status=404'),
			'proxy returns 404': assert_status(404)
		},
		'pass set-cookie from proxied app': {
			topic: call('/proxy/index.html?set-cookie=test&value=val1&maxAge=500&path=/abc&domain=.my.domain.com&secure=true&httpOnly=true'),
			'proxy returns a set-cookie': function (err, res, body) {
				assert(null!==res.headers['set-cookie']);
				assert_set_cookie(res,['test=val1', 'Domain=.my.domain.com', 'Path=/abc', 'Secure', 'HttpOnly','Max-Age=500']);	
			},
			'header mapping was applied, check by created header': function (err, res) { assert(null!==res.headers['x-x-powered-by']); }
		},
		'pass set-cookie from proxied app and rewrite /xshop': {
			topic: call('/proxy/index.html?set-cookie=test&value=val1&maxAge=400&path=/xshop/xyz/abc&domain=.my.domain.com&secure=true&httpOnly=true'),
			'proxy returns a set-cookie': function (err, res, body) {
				assert_set_cookie(res,['test=val1', 'Domain=.my.domain.com', 'Path=/shop/xyz/abc', 'Secure', 'HttpOnly','Max-Age=400']);
			},
			'header mapping was applied, check by created header': function (err, res) { assert(null!==res.headers['x-x-powered-by']); }
		},
		'pass cookie to proxied app': { topic : call('/proxy/index.html?cookie=xuser',{
			'Cookie':'otherID=F5AECCB147EA9F3A4E588D9EC504D37D; SESSID=aaaaaa5q9H-LvAX$reRJh-QFR4E12MLc-JxejKw0aaa-1369733986; SESS2=aaaaaaEFZO-NyZl$Q182M-l6iLXuboLL-B1yp/8/aaa-1369816649; xuser=P=55017+15960+31845+15841+8310+49853+46508+61438+1835+32255+58818+59569+49251+21672+13093+2473+8858+11426+49166+58443+53675+17057+24987+21402+51847+17157+1443+54322&L=50531+50922+60122+24071+23003+32635+6031+8600&A=21554+26955+21723+32708&S=50531+50922+60122+24071+23003+32635+6031+8600&T=8831+38575+18382+60549+26167+30505+30299+11160+21389+56867+49195+31007&X=23072+31682+22717+50771&U=886+7472+2256+14058&D=26907+54823+23179+1717+48511+53501+44996+29717+38819+1676+56036+19896&C=64433+22402+29581+20691+21554+26955+21723+32708&K=41258+34044+19575+22520&Z=MCwCFFSy4SMvVBaWswpnpRmCqLDSHU4lAhQBN0JTk3XNPC7I2YF+kSW2JEB+fA==' }),
			'proxy returns a cookie beginning with x': function (err, res, body) {
				assert.equal(body,'P=55017+15960+31845+15841+8310+49853+46508+61438+1835+32255+58818+59569+49251+21672+13093+2473+8858+11426+49166+58443+53675+17057+24987+21402+51847+17157+1443+54322&L=50531+50922+60122+24071+23003+32635+6031+8600&A=21554+26955+21723+32708&S=50531+50922+60122+24071+23003+32635+6031+8600&T=8831+38575+18382+60549+26167+30505+30299+11160+21389+56867+49195+31007&X=23072+31682+22717+50771&U=886+7472+2256+14058&D=26907+54823+23179+1717+48511+53501+44996+29717+38819+1676+56036+19896&C=64433+22402+29581+20691+21554+26955+21723+32708&K=41258+34044+19575+22520&Z=MCwCFFSy4SMvVBaWswpnpRmCqLDSHU4lAhQBN0JTk3XNPC7I2YF+kSW2JEB+fA==');
			}
		}
	}
});

suite.exportTo(module,{error:false});
