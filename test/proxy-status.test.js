'use strict';

var
	vows    = require('vows'),
	assert  = require('assert');

var proxy_status=require('../proxy-status')({

	5: function (req, res, next) {
		next && next("5");
		return;
	},
	4: function (req, res, next) {
		next && next("4");
		return;
	},
	'error': function (error, req, res, next) {
		next && next(error);
		return;
	}
});

var suite=vows.describe('Proxy-status handling');
suite.addBatch({
	'Invoke default next': {
		topic: function () {
			proxy_status({req:"req"}, {res:"res",proxy:{statusCode:200}}, this.callback);
		},
		'next': function () {
			assert.equal(arguments.length, 0);
		}
	},
	'Invoke next with param 500': {
		topic: function () {
			proxy_status({req:"req"}, {res:"res",proxy:{statusCode:500}}, this.callback);
		},
		'assert return': function () {
			assert.equal(arguments.length, 1);
		},
		'assert return of 5xx (error status)': function () {
			assert.equal(arguments[0], 5);
		}
		},
	'Invoke next with param 400': {
		topic: function () {
				proxy_status({req:"req"}, {res:"res",proxy:{statusCode:400}}, this.callback);
		},
		'assert return': function () {
			assert.equal(arguments.length, 1);
		},
		'assert return of 4xx (error status)': function () {
			assert.equal(arguments[0], 4);
		}
	},
	'Invoke error next': {
		topic: function () {
			proxy_status({req:"req"},{res:"res",proxy:{error:"timeout"}}, this.callback);
		},
		'assert one argument': function () {
			assert.equal(arguments.length, 1);
		},
		'assert timeout' : function() {
			assert.equal(arguments[0], "timeout");
		}
	},
	'No proxy result available': {
		topic: function () {
			proxy_status({req:"req"}, {res:"res"}, this.callback);
		},
		'assert return ': function () {
			assert.equal(arguments.length, 0);
		}
	}
});

suite.exportTo(module,{error:false});
