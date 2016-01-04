"use strict";
/**
 *  adapt internal absolute urls to relative urls
 */
var
	url    = require('url'),
	extend = require('x-common').extend;

var M,S;
module.exports = function(options){
	
	options = options || {from:'html'};
	if(typeof(options)==='string'){
		options = { from: options };
	}
	
	var
		from_property = options.from,
		to_property   = options.to || options.from;
	
	return extend(M=function (req, res, next) {
		
		var
			log    = req.log ? req.log(__filename) : {},
			html   = res[from_property];
		
		if ( html && req.proxy ) {
			var
				proxy      = req.proxy,
				relativize = proxy.relativize.bind(proxy);
			
			res[to_property] = M.replace(html,relativize);
		}
		next && next();
	},{
		tag : new RegExp(
			'(<(?:(?:img|iframe|script)[^>]+src="'+
			  '|link[^>]+href="'+
			  '|input[^>]+name="(?:error|success)"[^>]*value="'+ // we expect the input name *before* the value
			  '|x-ad-adition[^>]+data-url-fallback="'+
			  '|(?:a|form)[^>]+="'+
			  '|meta[^>]+http-equiv="refresh"[^>]*content="'+ // p.e. <meta http-equiv="refresh" content="0;URL=/shop/directbuy....">
			  '|redirect>(?:<c-data>)?'+ // handle wicket <ajax-response><redirect><c-data>url</c-data></redirect></ajax-response> preserve c-data if it exists
			  ')'+
			')'+         // before: < tag ... before the attribute
			'([^"<]*)'+  // u     : the url attribute value, or in case of <redirect>(<c-data>)  as content before the </c-data>
			'([^>]*>)',  // after : ...> after the attribute
			'img'),
		extern : {
			attr: /extern="(?:1|true)"/im,
			url:  /#extern/im
		},
		meta : {
			content : /;([\r\n\s]*URL[\r\n\s]*)=[\r\n\s]*([^\s]*)[\r\n\s]*$/i, // name, u
		},
		
		replace : function(html,relativize){
			
			return html.replace(M.tag,function(m,before,u,after){
				if(M.extern.url.test(u) || M.extern.attr.test(after) || M.extern.attr.test(before) || /.*\/_generic\/.*/.test(u) ) return m;
				
				var fc = m[1]; // first char to identify differen special cases
				switch(fc){
					case 'a': // <a ... >
					case 'f': // <form ... >
						// test href (data-)error|success|action
						return m.replace(/((?:href|action|error|success)=")([^"]*)/img,function(m,before,u){
							return before + (u ? relativize(u) : u);
						});
					case 'm': // <meta refresh content="..." >, change the url WITHIN the content
						return before + u.replace(M.meta.content,function(m,name,u){
							return ';url=' +  (u ? relativize(u) : u );
						}) + after;
					default: // all others including the <redirect><c-data>...<c-data> case
						return before + (u ? relativize(u) : u ) + after;
				}
			});
		}
	});
};
