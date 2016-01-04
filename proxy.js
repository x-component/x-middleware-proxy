"use strict";
/**
 * read content from CMS
 */
var
	callback = require('x-callback'),
	extend   = require('x-common').extend,
	merge    = require('x-common').merge,
	bool     = require('x-common').bool,
	proxy    = require('x-proxy');

/*
 * this middleware forwards the request the next server and adds the result to the response if body_property is given p.e. 'body'
 *
 * For now it will read the body completely.
 * Only html and text bodies are handled. Others are returned directly as a complete response.
 *
 * Note: This can be changed into reading chunks and let a future chunk aware middleware handle these chuncks.
 * Note: Chanhing this to forwarding chunks is alo required if streaming large bodies like viedeos
 *
 * perfrom call, place body into body   or data : host : url
 * then middleware can move body into data:   backend: url ...   cms template load
 *
 *
 */
var M;
module.exports = extend(M=function(options){
	
	options = merge({}, options, M.options);
	
	return function (req, res, next) {
		
		var
			log = req.log ? req.log(__filename) : {},
			data = res.data = res.data || {},
			errors = data.errors = data.errors || [],
			
			// inform middle ware dowstream about the proxying
			client       = M.client(options.client,req,errors,log),
			prx          = client ? proxy(req, client.config, options.mount) : null, // mount optional
			u            = prx ? prx.url(req.url) : null;
		
		if(!client || !u ){
			next && next();
			return;
		}
		
		var call_options = { method: req.method, url:u, preview:req.preview, encoding:null };
		if( call_options && req.body ) call_options.body=req.body;
		
		client(call_options, callback(log,res,function(err,client_res,body){
			
			if(err){return;} // logging , 500 done by callback
			
			// forward status code
			res.statusCode=client_res.statusCode;
			
			if ( res.statusCode >= 400 && ( 404 !== res.statusCode || options.client.strict ) ){
				res.send( res.statusCode );
				return;
			}
			
			req.proxy=prx;
			
			// do not forward any response headers for now
			var
				res_headers  = client_res.headers,
				content_type = client_res.headers['content-type'],
				is_html      = content_type && !!~content_type.indexOf('html'),
				is_text      = content_type && !!~content_type.indexOf('text');
			
			for(var h in res_headers) {
				res.setHeader(h,res_headers[h]);
			}
			
			// keep a property with headers to access them later in the pipeline p.e. for removal/updating location header etc.
			var
				tmp,
				headers_property = (tmp=options) && (tmp=tmp.response) && (tmp=tmp.property) ? tmp.headers : null,
				body_property    = (tmp=options) && (tmp=tmp.response) && (tmp=tmp.property) ? tmp.body : null;
			
			if( headers_property ){
				res[headers_property]=client_res.headers;
			}
			
			if( is_html || is_text ){
				body = body.toString('utf8');
				log.debug && log.debug(body);
			}
			
			// images, css etc. are forwared as is
			if( !is_html || !body_property ){
				res.end(body,is_text?'utf8':void 0); 
				return;
			}
			
			res[body_property]=body;
			
			if(data && client_res ){
				var
					app    = options.client.data || options.client.backend || 'proxy',
					path   = u,
					result = {};
					
				if(client_res.statusCode ){
					result.statusCode = client_res.statusCode;
				}
				if( content_type ) result.type = content_type;
				
				if( typeof body != typeof(void 0) ){
					if ( body instanceof Buffer ) body = body.toString('utf-8');
					result.body = body;
					if(result.body.length > 200 ){
						result.body.toJSON = function(){ return this.substring(200)+'...(first 200 chars, see '+__filename+' to change display)'; };
					}
				}
				result.headers=client_res.headers;
				if( ( options.param || options.header ) && client.config && client.config.url ){
					result.url = client.config.url; // http[s]://server[:port]/x
				}
				
				data[app] = data[app] || {};
				data[app][path] = result;
			}
			
			next && next();
		}));
	};
},{
	options : {
		
		client: {
			data    : void 0,  // alternative data: 'name'  // the backend is used from a special data client from the data directory
			backend : void 0,  // or  backend : 'name'  // backend is used from a backend client...
			param   : void 0,  // or in DEV/TEST ENVS only param ,'proxy',   use parameter to define proxy prefix "proxy=https://www.site.de/x" overrides header note this is dangereous as it creates an open arbitrary http proxy!
			header  : { host: 'host' , ssl: 'ISSSL' /*false, or boolean if no header*/ }, // or find host:port in header in header (http proxy behaviour)
			strict  : false // if false on 404 (not found) continue to next middleware, if true then send 404 as response
		},
		request:{
			headers: 'proxy_request_headers' // where to find headers to forward
		},
		response: {
			data: true, // note that the result is also stored at responnse.data.'proxy' and 'host:port'.{statusCode,body,err,type,headers}
			body:'body', // property where to store the body content
			headers: 'proxy_response_headers' // where to store the returned response headers
		}
	},
	
	// load dynamically a client for the proxy target (pm, mce, www.xyz.de), as defined via the options
	// from the data / backend directory or via parameter or headers
	client:function(options,req,errors){
		
		var log = req.log ? req.log(__filename) : {};
		
		var
			request,
			module_path,
			generic_url_prefix,
			err=null;
		
		if(options.data                    ) module_path = '../data/'    + options.data    + '/client';
		if(!module_path && options.backend ) module_path = '../backend/' + options.backend + '/client';
		
		if(!module_path && ( options.param || options.header )) {
			generic_url_prefix = req.param(options.param);
			
			if(!generic_url_prefix){
				var is_ssl = typeof options.header.ssl == 'string' ? bool(req.headers[options.header.ssl]) : !! options.header.ssl;
				generic_url_prefix = ( is_ssl ? 'https://' : 'http://') + req.headers[options.header.host];
			}
			
			if(generic_url_prefix) module_path = '../util/request';
		}
		
		if( module_path) try{
			request = require(module_path);
		} catch (e) {
			err=e;
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
				name    : 'PROXY '+generic_url_prefix,
				request : {
					timeout    : 60000, // we need this timeout that long since the back end is so awfully slow
					maxSockets : 128,
					headers    : {
					}
				}
			};
			request = request(generic_config);
			request.config=generic_config;
		}
		
		return request;
	}
});
