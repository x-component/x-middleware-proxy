'use strict';
/*
 * Returns an function which fires a inner request and puts the data (statusCode','headers','body)
 * from corresponding response to the outer response.
 *
 */

var
	callback = require('x-callback'),
	extend   = require('x-common').extend,
	merge    = require('x-common').merge,
	bool     = require('x-common').bool,
	pluck    = require('x-common').pluck,
	property = require('x-common').property,
	proxy    = require('x-proxy');

var M;
module.exports = extend (M = function(options){
	
	options = merge({}, options, M.options);
	
	var
		proxy_req_property = property(options.request),
		proxy_res_property = property(options.response);
	
	return function (req, res, next) {
		debugger;
		var
			log    = req.log ? req.log(__filename) : {},
			// inform middleware dowstream about the proxying
			errors = [],
			client       = M.client(options.client, req, res, errors, log),
			client_config = typeof(client.config)==='function'? client.config(req.preview) : client.config,
			prx          = client ? proxy(req, client_config, options.mount) : null, // mount optional
			u            = prx ? prx.url(req.url, true) : null;
		
		if(!client || !u ){
			log.error && log.error('could not load proxy client', { options:options } );
			next && next();
			return;
		}
		
		var proxy_req = proxy_req_property(req);
		if(!proxy_req) {
			next && next();
			return;
		}
		
		var call_options = merge({ method : req.method, url : u, preview : req.preview, encoding : null }, proxy_req);
		
		client(call_options, callback(log, function(err, client_res, body){
			req.proxy = extend(prx, req.proxy || {});
			
			// keep a property with headers to access them later in the pipeline
			// p.e. for removal/updating location header etc.
			var proxy_res = proxy_res_property(res);
			
			if(!proxy_res) proxy_res = proxy_res_property(res, {});
			
			if(err) {  // logging done by callback
				proxy_res.error = err;
				next && next();
				return;
			}
			
			extend(proxy_res, pluck(client_res, ['statusCode', 'headers', 'body']));
			
			next && next();
		}));
	};
},{
	options : {
		
		client: {
			data    : void 0,  // alternative data: 'name'  // the backend is used from a special data client from the data directory
			backend : void 0,  // or  backend : 'name'  // backend is used from a backend client...
			param   : void 0,  // or in DEV/TEST ENVS only param ,'proxy',   use parameter to define proxy prefix "proxy=https://www.site.de/x" overrides header note this is dangereous as it creates an open arbitrary http proxy!
			header  : { host: 'host' , ssl: 'x-isssl' /*false, or boolean if no header*/ }, // or find host:port in header in header (http proxy behaviour)
			strict  : false    // if false on 404 (not found) continue to next middleware, if true then send 404 as response
		},
		request : 'proxy',
		response: 'proxy'
	},
	
	// load dynamically a client for the proxy target (pm, mce, www.xyz.de), as defined via the options
	// from the data / backend directory or via parameter or headers
	
	client:function(options, req, res, errors){
		var
			log = req.log ? req.log(__filename) : {},
			module_path,
			generic_url_prefix,
			backend_origin,
			err = null;
		
		if(options.data                    ) module_path = options.data    + '/client';
		if(!module_path && options.backend ) module_path = options.backend + '/client';
		
		if(!module_path && ( options.param || options.header )) {
			if(options.param){
				generic_url_prefix = req.param(options.param);
				// accept only the first given parameter
				if(Array.isArray(generic_url_prefix)) generic_url_prefix =(0 in generic_url_prefix ? generic_url_prefix[0] : null);
				
				// remove the proxy parameter from the url
				if(req.query){
					delete req.query[options.param];
				}
				if(req.url){
					req.url = req.url
						.replace(new RegExp(options.param+'=[^&]*(&|$)','g'),'')
						.replace(/\?$/,'');
				}
				if(generic_url_prefix) backend_origin = 'PARAMETER '+options.param+' '; // for logging
			}
			
			if(!generic_url_prefix) {
				var is_ssl = typeof options.header.ssl === 'string' ? bool(req.headers[options.header.ssl]) : !! options.header.ssl;
				// get first header that is set to define the proxy target as contained in proxy_options.client.header.host
				// but prefer those *not* equal to 'host'
				var
					tmp,
					headers = Array.isArray(tmp=( (tmp=options.header) && (tmp=tmp.host) ? tmp : 'host' )) ? tmp : [tmp];
				for(var i=0,l=headers.length,h,host;i<l && (!generic_url_prefix || h==='host');i++){
					h = headers[i];
					host = req.headers[h];
					if( host ) generic_url_prefix = ( is_ssl ? 'https://' : 'http://') + host;
					if( h !=='host' && res && res.addHeader) res.addHeader('Vary', h );
				}
				if(generic_url_prefix) backend_origin = 'HOST HEADER ';  // for logging
			}
			
			if(generic_url_prefix){
				// never use query parts in a proxy base url
				generic_url_prefix = generic_url_prefix.replace(/\?.*$/,'');
				
				module_path = 'x-requests';
			}
		}
		
		var request; // module
		if( module_path) try {
			request = require(module_path);
		} catch (e) {
			err = e;
		}
		
		if( err || !request || typeof( request ) !== 'function' ){
			var
				msg = 'could not load request client for proxy',
				obj = extend( {options:options }, err || {} );
			
			log.error && log.error( msg, extend({}, obj, {module: module_path }) ); // note keep module path info private in log
			
			if(errors) errors.push( extend( {code:'load', msg:msg },obj ) );
			
			return null;
		}
		
		if(generic_url_prefix){
			var generic_config = {
				url     : generic_url_prefix,
				name    : 'PROXY ' + ( backend_origin || '' ) + generic_url_prefix,
				request : merge({
					timeout    : 3000,
					maxSockets : 128,
					followRedirect: false,
					headers    : {
					}
				},options.request||{})
			};
			debugger;
			request = request(generic_config);
			request.config = generic_config;
		}
		return request;
	}
});
