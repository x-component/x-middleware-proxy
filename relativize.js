"use strict";
/**
 *  adapt internal absolute urls to relative urls
 */
var
	url    = require('url'),
	extend = require('x-common').extend;

var M,S;
module.exports = extend(M=function (req, res, next) {
	
	var log    = req.log ? req.log(__filename) : {},
		$      = res.window ? res.window.$ : null;
	
	if ( $ && req.proxy ) {
		var proxy = req.proxy,
			each  = M.each;
		
		each( $, 'src'              , proxy );
		each( $, 'action'           , proxy );
		each( $, 'href'             , proxy );
		each( $, 'error'            , proxy );
		each( $, 'success'          , proxy );
		each( $, 'data_error'       , proxy, 'data-error'        );
		each( $, 'data_success'     , proxy, 'data-success'      );
		each( $, 'input_error'      , proxy, 'value'             );
		each( $, 'input_success'    , proxy, 'value'             );
		
		// handle meta redirect attributes, this need some extra parsing as the url is embedded in the content attribute:
		// <meta http-equiv="refresh" content="0;URL=/shop/directbuy....">
		$( 'meta[http-equiv]' ).each( function(el){
			//debugger;
			var
				$el = $(el),
				http_equiv =$el.attr('http-equiv').join();
			
			if(!/refresh/i.test(http_equiv)) return;
			
			var content = $el.attr('content').join();
			
			if(!content) return;
			
			content = content.replace(/;([\r\n\s]*URL[\r\n\s]*)=[\r\n\s]*(.*)[\r\n\s]*$/i,function(match,name,value){
				if( value ) value = proxy.relativize( value.trim() );
				return ';url=' + value;
			});
			
			$el.attr('content', content );
		});
	}
	next && next();
},{
	select : extend(S=function(tags,attr){
		var selector = tags.concat(['']).join('['+attr+'] ,');
		selector = selector.substring(0,selector.length-1);
		return selector;
	},{
		src               : S( ['img','iframe','script'],'src' ),
		action            : S( ['form'    ],'action'      ),
		href              : S( ['a','link'],'href'        ),    // TODO base href , special handling , can it be relative ? 
		error             : S( ['a','form'],'error'       ),  // extension for operation rendering
		success           : S( ['a','form'],'success'     ),  // extension for operation rendering
		data_error        : S( ['a','form'],'data-error'  ),  // extension for operation rendering
		data_success      : S( ['a','form'],'data-success'),  // extension for operation rendering
		input_error       : S( ['input'   ],'name=error'  ),
		input_success     : S( ['input'   ],'name=success')
	}),
	
	each:function( $, selector_name, proxy, attr_name ){
		attr_name = attr_name || selector_name ;
		$( M.select[selector_name] ).each( function(el){
			//debugger;
			var tmp,
				$el = $(el),
				el_url = $el.attr(attr_name).join();
			//debugger;
			if( el_url && el_url.length ) {
				$el.attr( attr_name, proxy.relativize( el_url ) );
			}
		});
	}
});

