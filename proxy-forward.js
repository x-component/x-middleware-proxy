'use strict';
/**
 * this middleware prepares the internal proxy request and forwards the intenral proxy response
 */
var callback = require('x-callback'),
	extend   = require('x-common').extend,
	merge    = require('x-common').merge,
	bool     = require('x-common').bool,
	property = require('x-common').property,
	proxy    = require('x-proxy'),
	url      = require('url');

var M;
module.exports = {
	/*
	 *  Prepares the inner proxy request by creating an object with all related reuqest data.
	 *
	 *  The existing body of the outer request will be added to the proxy request.
	 */
	request : function(proxy_property) {
		
		proxy_property = proxy_property || 'proxy';
		
		var proxy = property(proxy_property);
		
		return function (req, res, next) {
			
			var proxy_req = proxy(req);
			if(!proxy_req) {
				proxy_req = proxy(req, {});
			}
			
			var body = req.body;
			if(body ){
				// forward parsed form data from p.e. a POST
				// parsing was done by the servers connect bodyParser  (server.use....) in server.js
				if( typeof(body)==='object' &&  !(body instanceof Buffer) ){
					proxy_req.form = body;
				} else {
					// not a form
					proxy_req.body = body;
				}
			}
			next && next();
		};
	},
	/*
	 *  Forwards the existing inner response, if it is not of content-type html or text.
	 *  Otherwise statusCode and body of inner response will be stored in the outer response for further transformation.
	 */
	response : function(options){
		
		if(typeof(options)==='string'){ // old usage
			options = { proxy: options };
		}
		
		// defaults
		options = merge({},{
			proxy: 'proxy',
			content_type : {
				include: /.*/, // content types to forward, default all .*
				exclude: /html|xml/,  // content types not to forward default: html, xml
				text   : /text|html|xml/ // these content type buffers are transformed to utf-8 strings
			}
		},options);
		
		var
			tmp,
			proxy_property = options.proxy,
			proxy          = property(proxy_property),
			include        = (tmp=options) && (tmp=tmp.content_type) ? tmp.include : null,
			exclude        = (tmp=options) && (tmp=tmp.content_type) ? tmp.exclude : null,
			text           = (tmp=options) && (tmp=tmp.content_type) ? tmp.text    : null;
		
		return extend(function F(req, res, next) {
			var log = req.log ? req.log(__filename) : {};
			
			var proxy_res = proxy(res);
			if(!proxy_res){
				next && next();
				return;
			}
			
			if(proxy_res.error) { // previous middleware proxy-error should remove this if wanted
				next && next(proxy_res.error);
				return;
			}
			
			res.statusCode = proxy_res.statusCode;
			
			var
				res_headers  = proxy_res.headers,
				content_type = res_headers ? res_headers['content-type'] : null,
				is_included  = content_type && include ? include.test(content_type):true,
				is_excluded  = content_type && exclude ? exclude.test(content_type):false,
				is_text      = content_type && text    ?    text.test(content_type):false,
				body         = proxy_res.body,
				isRedirect   = res.proxy && res.proxy.statusCode && res.proxy.statusCode>=300 && res.proxy.statusCode<=399;
			
			if( body && is_text ) {
				body = body.toString('utf8'); // TODO we only allow UTF8 for now!
				log.debug && log.debug(body);
			}
			
			// images, css etc. are forwared as is
			if( body && is_included && !is_excluded && !isRedirect ){
				F.headers( res, res_headers );
				res.end(body, is_text ? 'utf8' : void 0);
				return;
			}
			
			F.headers( res, res.headers ); // headers already mapped by map-header
			
			if(body) res.body = body;
			
			next && next();
		},{
			headers: function( res, headers ){
				for( var name in headers ){
					var value = headers[name];
					
					// VARY
					if( /^Vary$/i.test(name) && res.addHeader ){ // if middleware util is used before its there
						// vary headers must always be merged
						if(!Array.isArray(value)) value = value.split(/\s*,\s*/);
						res.addHeader( 'Vary', value ); // explicitly use "Vary"
					
					// SET-COOKIE
					} else if( /^set-cookie$/i.test(name) && Array.isArray(value) ){
						// ensure multiple single set cookie headers are used,
						// and the value is not serialized in a single set-cookie header
						for( var i=0, l=value.length; i<l; i++ ){
							res.setHeader( name, value[i] );
						}
					
					} else {
						res.setHeader( name, value );
					}
				}
			}
		});
	}
};
