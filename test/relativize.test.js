'use strict';
// call with ./util/node_modules/vows/bin/vows middleware/test/relativize.test.js

var vows       = require('vows'),
	assert     = require('assert'),
	relativize = require('../relativize'),
	dom        = require('x-dom'),
	xui        = require('x-xui'),
	proxy      = require('x-proxy'),
	log        = require('x-log'),
	extend     = require('x-common').extend,
	config     = require('x-configs')(__dirname+'/config.js'),
	suite      = vows.describe('relativize'),
	debug      = true; //false;


var call = function(options/*html,target:{url},mount*/){
	return function(test){
		var self=this;
		//debugger;
		dom.parse(options.html, function (err, win) {
			//debugger;
			if(win){
				var
					req  = {
						log     : function(){ return debug ? log : {}; },
						url     : options.url,
						server  : { config: config },
						headers :  options.headers || {}
					},
					res  = { window : win },
					next = function() { self.callback(req,res); };
				
				req.proxy = proxy(req,{ url: options.target.url }, options.mount);
				
				xui(res.window,function(){
						test( req, res, next);
				});
			}
			else {
				self.callback(null,null);
			}
		});
	};
};

var test=function(url,tag,attr,name){
	tag   = tag   || 'a';
	attr  = attr  || 'href';
	var html='<'+tag+' '+attr+'=\"'+url+'\" '+(name?' name=\"'+name+'\"':'')+'></'+tag+'>';
	return '<html>\n<head>\n</head>\n<body>'+html+'</body>\n</html>';
};

var check = function( base, u, result, headers, mount, target_url, tag, attr, name){
	//debugger;
	tag  = tag   || 'a';
	attr = attr  || 'href';
	
	var attr_sel   = (name ? 'name='+name : attr);
	
	var o={
		topic: call({
			url : base,
			target : {
				url : target_url
			},
			html : test(u,tag,attr,name),
			mount : mount,
			headers : headers
		})
	};
	o['check '+result]=function(req,res){
		//debugger;
		var attr_url = res.window.$(tag+'['+attr_sel+']').attr(attr).join();
		assert.equal( attr_url, result );
	};
	if(u !== '' && result !=='' && !/^http/.test(u) && !/^http/.test(result)  ){ // not yet ... TODO?
		o['resolve check '+result]=function(req,res){
			//debugger;
			var attr_url = res.window.$(tag+'['+attr_sel+']').attr(attr).join();
			var relative_resolved = req.proxy.resolve( attr_url );
			var absolut_resolved  = req.proxy.resolve( u );
			assert.equal( relative_resolved, absolut_resolved );
		};
	}
	
	return o;
};



suite.addBatch({
	'relativize with html href tests': { topic: function(){ return relativize; },
		
		// mounted proxy target relative ones
		'mounted target testSingleAbs' :  check('/mountpath/x/a/foo'  ,'/mobile-portal/b'    ,'../b' , null, 'mountpath/x' , 'http://www.x-x.io/mobile-portal' ),
		
		// some edge cases
		'testSingleAbs' :         check('/a'  ,'/b'    ,'b'    ),
		'testSingleRel' :         check('/a'  , 'b'    ,'b'    ),
		'testSingleAbsSlash' :    check('/a'  , '/b/'  ,'b/'   ),
		'testSingleRelSlash' :    check('/a'  , 'b/'   ,'b/'   ),
		'testSingleRoot' :        check('/a'  , '/'    ,''     ),
		'testSingleEmpty' :       check('/a'  , ''     ,''     ),
		'testSingleEmpty2' :      check('/a'  , '?x=5' ,'?x=5' ),
		'testRootSingleRoot' :    check('/'   , '/'    ,''     ),
		'testRootSingleEmpty2' :  check('/'   , ''     ,''     ),
		
		'testRelativeURLOriginNoSlashAndAddComponent'   : check('/bla/option/x/','/bla/option/x/session/','session/'),
		'testRelativeURLOriginWithSlashAndAddComponent' : check('/bla/option/x/','/bla/option/x/session/','session/'),
		
		// some tests
		'test_1_1' :  check('/foo/foo2/foo3','../foo4?foo=1&bar=2','../foo4?foo=1&bar=2'),
		'test_1_2' :  check('/foo/foo2/foo3','foo4?foo=1&bar=2','foo4?foo=1&bar=2'),
		'test_1_3' :  check('/foo/foo2/foo3','.?foo=1&bar=2'  , '../foo2/?foo=1&bar=2'), // resolved: /foo/foo2/?.. 
		'test_1_4' :  check('/foo/foo2/foo3','..?foo=1&bar=2' ,'../../foo/?foo=1&bar=2'), // resolved: /foo/?... 
		'test_1_5' :  check('/foo/foo2/foo3','/foo4/foo5?foo=1&bar=2','../../foo4/foo5?foo=1&bar=2'),
		'test_1_6' :  check('/foo/foo2/foo3','../../foo2/foo4?foo=1&bar=2','../../foo2/foo4?foo=1&bar=2'),
		
		// some relatives with / at end
		'test_1_1Slash' :  check('/foo/foo2/foo3','../foo4/?foo=1&bar=2','../foo4/?foo=1&bar=2'),
		'test_1_2Slash' :  check('/foo/foo2/foo3','foo4/?foo=1&bar=2','foo4/?foo=1&bar=2'),
		'test_1_3Slash' :  check('/foo/foo2/foo3','./?foo=1&bar=2','../foo2/?foo=1&bar=2'),
		'test_1_4Slash' :  check('/foo/foo2/foo3','../?foo=1&bar=2','../../foo/?foo=1&bar=2'),
		'test_1_5Slash' :  check('/foo/foo2/foo3','/foo4/foo5/?foo=1&bar=2','../../foo4/foo5/?foo=1&bar=2'),
		'test_1_6Slash' :  check('/foo/foo2/foo3','../../foo2/foo4/?foo=1&bar=2','../../foo2/foo4/?foo=1&bar=2'),
		
		// shorter
		'test_1_Shorter1' :  check('/foo/foo2/foo3','/foo/foo2?foo=1&bar=2','../foo2?foo=1&bar=2'),
		'test_1_Shorter2' :  check('/foo/foo2/foo3','/foo?foo=1&bar=2','../../foo?foo=1&bar=2'),
		
		// shorter with /
		'test_1_Shorter1Slash' :  check('/foo/foo2/foo3','/foo/foo2/?foo=1&bar=2','../foo2/?foo=1&bar=2'),
		'test_1_Shorter2Slash' :  check('/foo/foo2/foo3','/foo/?foo=1&bar=2','../../foo/?foo=1&bar=2'),
		
		// shorter switch to other path
		'test_1_Switch1' :  check('/foo/foo2/foo3','/foo/foo4?foo=1&bar=2','../foo4?foo=1&bar=2'),
		'test_1_Switch2' :  check('/foo/foo2/foo3','/foo5?foo=1&bar=2','../../foo5?foo=1&bar=2'),
		
		// shorter switch to other path with /
		'test_1_Switch1Slash' :  check('/foo/foo2/foo3','/foo/foo4/?foo=1&bar=2','../foo4/?foo=1&bar=2'),
		'test_1_Switch2Slash' :  check('/foo/foo2/foo3','/foo5/?foo=1&bar=2','../../foo5/?foo=1&bar=2'),
		
		
		// longer same
		'test_1_Longer1' :  check('/foo/foo2/foo3','/foo/foo2/foo3?foo=1&bar=2','foo3?foo=1&bar=2'),
		'test_1_Longer2' :  check('/foo/foo2/foo3','/foo/foo2/foo3?foo=1&bar=2','foo3?foo=1&bar=2'),
		'test_1_Longer3' :  check('/foo/foo2/foo3','/foo/foo2/foo3/foo5?foo=1&bar=2','foo3/foo5?foo=1&bar=2'),
		
		// longer same with slash
		'test_1_Longer1Slash' :  check('/foo/foo2/foo3','/foo/foo2/foo3/?foo=1&bar=2','foo3/?foo=1&bar=2'),
		'test_1_Longer2Slash' :  check('/foo/foo2/foo3','/foo/foo2/foo4/?foo=1&bar=2','foo4/?foo=1&bar=2'),
		'test_1_Longer3Slash' :  check('/foo/foo2/foo3','/foo/foo2/foo3/foo5/?foo=1&bar=2','foo3/foo5/?foo=1&bar=2'),
		
		// -- same tests with base with slash at end
		// some tests base with slash at end
		
		'test_2_1' :  check('/foo/foo2/foo3/','../foo4?foo=1&bar=2','../foo4?foo=1&bar=2'),
		'test_2_2' :  check('/foo/foo2/foo3/','foo4?foo=1&bar=2','foo4?foo=1&bar=2'),
		'test_2_3' :  check('/foo/foo2/foo3/','.?foo=1&bar=2','../foo3/?foo=1&bar=2'),
		'test_2_4' :  check('/foo/foo2/foo3/','..?foo=1&bar=2','../../foo2/?foo=1&bar=2'),
		'test_2_5' :  check('/foo/foo2/foo3/','/foo4/foo5?foo=1&bar=2','../../../foo4/foo5?foo=1&bar=2'),
		'test_2_6' :  check('/foo/foo2/foo3/','../../foo2/foo4?foo=1&bar=2','../foo4?foo=1&bar=2'),
		
		// some relatives with / at end, base with slash at end
		
		'test_2_1Slash' :  check('/foo/foo2/foo3/','../foo4/?foo=1&bar=2','../foo4/?foo=1&bar=2'),
		'test_2_2Slash' :  check('/foo/foo2/foo3/','foo4/?foo=1&bar=2','foo4/?foo=1&bar=2'),
		'test_2_3Slash' :  check('/foo/foo2/foo3/','./?foo=1&bar=2','../foo3/?foo=1&bar=2'),
		'test_2_4Slash' :  check('/foo/foo2/foo3/','../?foo=1&bar=2','../../foo2/?foo=1&bar=2'),
		'test_2_5Slash' :  check('/foo/foo2/foo3/','/foo4/foo5/?foo=1&bar=2','../../../foo4/foo5/?foo=1&bar=2'),
		'test_2_6Slash' :  check('/foo/foo2/foo3/','../../foo2/foo4/?foo=1&bar=2','../foo4/?foo=1&bar=2'),
		
		// shorter, base with slash at end
		'test_2_Shorter1' :  check('/foo/foo2/foo3/','/foo/foo2?foo=1&bar=2','../../foo2?foo=1&bar=2'),
		'test_2_Shorter2' :  check('/foo/foo2/foo3/','/foo?foo=1&bar=2','../../../foo?foo=1&bar=2'),
		
		// shorter with /, base with slash at end
		'test_2_Shorter1Slash' :  check('/foo/foo2/foo3/','/foo/foo2/?foo=1&bar=2','../../foo2/?foo=1&bar=2'),
		'test_2_Shorter2Slash' :  check('/foo/foo2/foo3/','/foo/?foo=1&bar=2','../../../foo/?foo=1&bar=2'),
		
		// shorter switch to other path, base with slash at end
		'test_2_Switch1' :  check('/foo/foo2/foo3/','/foo/foo4?foo=1&bar=2','../../foo4?foo=1&bar=2'),
		'test_2_Switch2' :  check('/foo/foo2/foo3/','/foo5?foo=1&bar=2','../../../foo5?foo=1&bar=2'),
		
		// shorter switch to other path with /, base with slash at end
		'test_2_Switch1Slash' :  check('/foo/foo2/foo3/','/foo/foo4/?foo=1&bar=2','../../foo4/?foo=1&bar=2'),
		'test_2_Switch2Slash' :  check('/foo/foo2/foo3/','/foo5/?foo=1&bar=2','../../../foo5/?foo=1&bar=2'),
		
		// longer same ,base with slash at end
		'test_2_Longer1' :  check('/foo/foo2/foo3/','/foo/foo2/foo3?foo=1&bar=2','../foo3?foo=1&bar=2'),
		'test_2_Longer2' :  check('/foo/foo2/foo3/','/foo/foo2/foo4?foo=1&bar=2','../foo4?foo=1&bar=2'),
		'test_2_Longer3' :  check('/foo/foo2/foo3/','/foo/foo2/foo3/foo5?foo=1&bar=2','foo5?foo=1&bar=2'),
		
		// longer same with slash
		'test_2_Longer1Slash' :  check('/foo/foo2/foo3/','/foo/foo2/foo3/?foo=1&bar=2','../foo3/?foo=1&bar=2'),
		'test_2_Longer2Slash' :  check('/foo/foo2/foo3/','/foo/foo2/foo4/?foo=1&bar=2','../foo4/?foo=1&bar=2'),
		'test_2_Longer3Slash' :  check('/foo/foo2/foo3/','/foo/foo2/foo3/foo5/?foo=1&bar=2','foo5/?foo=1&bar=2'),
		
		'test_case_1_usage_Slash'    : check('/node/usage', '/node/index.js?v=ct064e90trr4yjymb4kt3t7gpw', 'index.js?v=ct064e90trr4yjymb4kt3t7gpw'),
		'test_case_2_usage_no_Slash' : check('/node/usage/', '/node/index.js?v=ct064e90trr4yjymb4kt3t7gpw', '../index.js?v=ct064e90trr4yjymb4kt3t7gpw'),
		
		// recognize external and non external links
		'testExernalLink'                    : check('/foo/foo2/foo3','http://external:80/foo/foo2/foo3','http://external:80/foo/foo2/foo3'),
		
		'testNonExternalSameServerPortLink'  : check('/foo/foo2/foo3','http://server:80/foo/foo2/foo4','foo4',{host:'server:80'}),
		'testNonExternalSameServerPortLink2' : check('/foo/foo2/foo3','http://server:80/foo/foo2/foo3/../foo4','foo4',{host:'server:80'}),
		'testNonExternalSameServerLink'      : check('/foo/foo2/foo3','http://server/foo/foo2/foo4','foo4',{host:'server'}),
		'testExternalOtherPortLink'          : check('/foo/foo2/foo3','http://server:90/foo/foo2/foo4','http://server:90/foo/foo2/foo4',{host:'server:80'}),
		'testExternalOtherServerLink'        : check('/foo/foo2/foo3','http://server2:80/foo/foo2/foo4','http://server2:80/foo/foo2/foo4',{host:'server:80'}),
		'testExternalOtherSchemeLink'        : check('/foo/foo2/foo3','https://server:80/foo/foo2/foo4','https://server:80/foo/foo2/foo4',{host:'server:80'}),
		
		// implicit ports
		'testNonExternalSameServerImplicitPortRight80Link': check('/foo/foo2/foo3','http://server:80/foo/foo2/foo4','foo4',{host:'server'}),
		'testNonExternalSameServerImplicitPortLeft80Link' : check('/foo/foo2/foo3','http://server/foo/foo2/foo4','foo4',{host:'server:80'}),
		'switch to ssh external link' : check(
			'/foo/bar/foo2/foo3?x=1&y=2', // current url
			'https://server:443/foo/bar/foo2/foo4', // url to relativize which is not possible, we need an absolute link
			'https://m.x-x.io/funky/foo2/foo4',  // <--- expected result
			{ // headers defining the external_url and host header for the server_url
				host:'server:80',
				isssl:false,
				'x-forwarded-host':' m.x-x.io, proxy1:80808, prx2',
				'x-x-forwarded-request' : '/funky/foo2/foo3?x=1&y=2'  // this becomes thus http://m.x-x.io/funky/foo2/foo3?x=1&y=2
			}
		),
		'switch to non ssh via exernal link' : check(
			'/foo/bar/foo2/foo3?x=1&y=2', // current url
			'http://server/foo/bar/foo2/foo4', // url to relativize which is not possible, we need an absolute link
			'http://m.x-x.io/funky/foo2/foo4',  // <--- expected result
			{ // headers defining the external_url and host header for the server_url
				host:'server:80',
				isssl:true,
				'x-forwarded-host':' m.x-x.io, proxy1:80808, prx2',
				'x-x-forwarded-request' : '/funky/foo2/foo3?x=1&y=2'  // this becomes thus http://m.x-x.io/funky/foo2/foo3?x=1&y=2
			}
		),
		
		// escaping
		'testUrlEncoded' : check('/a/%3A%3A%3A/%25%25%25','/a/%3A%3A%3A/%5B%5B%5B/%25%25%25?%24=%26%26%26','%5B%5B%5B/%25%25%25?%24=%26%26%26')
	},
	'relativize with different html elements': { topic: function(){ return relativize; },
		'img    src'          :         check('/a'  , '/b/'  ,'b/'    , void 0, void 0, void 0, 'img'    , 'src'       ),
		'iframe src'          :         check('/a'  , '/b/'  ,'b/'    , void 0, void 0, void 0, 'iframe' , 'src'       ),
		'script src'          :         check('/a'  , '/b/'  ,'b/'    , void 0, void 0, void 0, 'script' , 'src'       ),
		'form   action'       :         check('/a'  , '/b/'  ,'b/'    , void 0, void 0, void 0, 'form'   , 'action'    ),
		'a      href'         :         check('/a'  , '/b/'  ,'b/'    , void 0, void 0, void 0, 'a'      , 'href'      ),
		'link   href'         :         check('/a'  , '/b/'  ,'b/'    , void 0, void 0, void 0, 'link'   , 'href'      ),
		// 'base   href'      :         check('/a'  , '/b/'  ,'b/'    , void 0, void 0, void 0, 'base'   , 'href'      ), BASE PROBABLY NEEDS AN EXTRNAL ABSOLUTE URL?
		'a      error'        :         check('/a'  , '/b/'  ,'b/'    , void 0, void 0, void 0, 'a'      , 'error'   ), // note 'onerror' doesn't work as it interprets the content not as uri but as javascript
		'form   error'        :         check('/a'  , '/b/'  ,'b/'    , void 0, void 0, void 0, 'form'   , 'error'   ),
		'a      success'      :         check('/a'  , '/b/'  ,'b/'    , void 0, void 0, void 0, 'a'      , 'success' ),
		'form   success'      :         check('/a'  , '/b/'  ,'b/'    , void 0, void 0, void 0, 'form'   , 'success' ),
		'a      data-error'   :         check('/a'  , '/b/'  ,'b/'    , void 0, void 0, void 0, 'a'      , 'data-error'   ), // note 'onerror' doesn't work as it interprets the content not as uri but as javascript
		'form   data-error'   :         check('/a'  , '/b/'  ,'b/'    , void 0, void 0, void 0, 'form'   , 'data-error'   ),
		'a      data-success' :         check('/a'  , '/b/'  ,'b/'    , void 0, void 0, void 0, 'a'      , 'data-success' ),
		'form   data-success' :         check('/a'  , '/b/'  ,'b/'    , void 0, void 0, void 0, 'form'   , 'data-success' ),
		'input  success'      :         check('/a'  , '/b/'  ,'b/'    , void 0, void 0, void 0, 'input'  , 'value'     , 'success' ),
		'input  error'        :         check('/a'  , '/b/'  ,'b/'    , void 0, void 0, void 0, 'input'  , 'value'     , 'error'   )
	},
	'meta redirect' :{ topic: function(){ return relativize; },
		'relative meta redirect' :{
			topic: call({
				url : 'http://m.test2.x-x.io/shop/',
				target : {
					url : 'http://muc:8181/mshop'
				},
				html : '<html><head><meta http-equiv="refresh" content="0;URL=/mshop/blub"></meta></head><body></body></html>',
				mount : '/shop'
			}),
			'check meta redirect': function(req,res){
				//debugger;
				var attr_url = res.window.$('meta').attr('content').join();
				assert.equal( attr_url,'0;url=blub');
			}
		}
	}
}).exportTo(module,{error:false});
