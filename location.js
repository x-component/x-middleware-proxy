'use strict';
/**
 *  location url reverse rewrite for the location header
 *  this uses request.proxy which  contains the proxy target config
 *
 *  reverse rewrite example 
 *  input location url = http://cmsserver:port/prefix/foo/bar;session=XYZ?f=1&b=2
 *  result url shoud be  = http://myname:myport/mount/foo/bar;session=ABC?f=1&b=2
 */
var
	url      = require('url'),
	merge    = require('x-common').merge,
	extend   = require('x-common').extend,
	property = require('x-common').property,
	proxy    = require('x-proxy');


module.exports = extend(function F( headers_property ){
	
	var headers = headers_property ? property(headers_property) : null;
	
	return function (req, res, next) {
		
		// the Location header is set on HTTP 302 redirect to an *absolute* url where the browser should go to
		var location_url = res.getHeader('Location');
		
		var hs = headers ? headers(res) : null; // response headers
		
		if( !location_url && hs ){ // proxy pass reverse : transform it from proxied target server
			location_url = hs ? (hs['Location'] || hs['location']) : null;
			if ( location_url ) location_url = F.reverse( req, location_url );
		}
		if( location_url ){ // make sure it is absolute beginning with http:// https:// according to RFC for HTTP 1.0, 1.1
			location_url=F.absolutize( req, location_url );
		}
		
		if( location_url ){ // remove all /.. parts in the path, to make it really absolute
			location_url = proxy.resolve( location_url );
		}
		
		if( location_url ){ // set Location header to the final result
			res.setHeader('Location', location_url );
		}
		
		// AJAX FIX (Wicket), wicket returns a relative link which must be reversed / externalized if its an absolute one
		var ajax_location = hs ? hs['ajax-location'] : null;
		if( ajax_location ){
			//debugger;
			ajax_location = F.relativize(req, ajax_location );
			res.setHeader('Ajax-Location', ajax_location );
		}
		
		next && next();
	};
},{
	absolutize:function( req, location_url ){ // only for node server local redirects (they can be non absolut)
		var log = req.log ? req.log(__filename) : {};
		
		if ( !location_url ) return location_url;
		
		try {
			var new_location_url = proxy.resolve( req.originalUrl || req.url ,location_url); // remove all . and ..
			
			// ensure the location to be absolute. Note per HTTP definition it should already be absolute!
			if( !/^http/.test(new_location_url) ){
				new_location_url = proxy.absolutize(req, new_location_url, true);
			}
			
			if( location_url !== new_location_url ){
				log.debug && log.debug( 'created absolute location header:' + location_url + '->' + new_location_url );
				location_url = new_location_url;
			}
		} catch ( e ) {
			log.error && log.error('could not make location header absolute:' + location_url, e );
		}
		
		return location_url;
	},
	
	reverse:function( req, location_url ){ // only for proxy related location url, example backend url http://x-x.io/mobile-portal/x
		var log = req.log ? req.log(__filename) : {};
		
		if( location_url ){
			try {
				if( req.proxy ){
					
					if( !/^http/.test(location_url) ){ // HOTFIX BACKEND DID SEND A RELATIVE URL WITH NO HTTP
						// ensure the location to be absolute. Note per HTTP definition it should already be absolute!
						location_url = req.proxy.resolve( location_url, true);
					}
					
					var new_location_url = proxy.resolve(location_url); // remove intermediate . or .. in the path
					
					// reverse rewrite internal urls, internal check is done in reverse
					new_location_url = req.proxy.reverse( new_location_url, true );
					
					if( location_url !== new_location_url ){
						log.debug && log.debug( 'reverse rewrite location header:' + location_url + '->' + new_location_url );
						location_url = new_location_url;
					}
				} else {
					log.error && log.error('tried to reverse rewrite a location url, while NOT in a request ??');
				}
			} catch ( e ) {
				log.error && log.error( 'could not reverse rewrite location header:' + location_url, e );
			}
		}
		return location_url;
	},
	relativize:function( req, u ){ // only for proxy related relative urls in headers like wickets Ajax-Location
		var log = req.log ? req.log(__filename) : {};
		
		if( u ){
			try {
				if( req.proxy ){
					
					var new_u = req.proxy.relativize(u);
					
					if( u !== new_u ){
						log.debug && log.debug( 'relativize ajax-location header:' + u + '->' + new_u );
						u = new_u;
					}
				} else {
					log.error && log.error('tried to relativize rewrite an ajax-location url, while NOT in a request ??');
				}
			} catch ( e ) {
				log.error && log.error( 'could not relativize ajax-location header:' + u, e );
			}
		}
		return u;
	}
});
