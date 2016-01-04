'use strict';

var extend   = require('x-common').extend;

/**
 * maps name value string pairs in the formats
 * - {name1:"valueA, valueB", name2:"valueC", ... } or
 * - or {name1:["valueA", "valueB"], name2:"valueC", ... }
 * - or in an array with [{name1:valueA},{name1:valueB},{name2:valueC}] to
 * new key values pairs based on a map with regular expressions
 * note for a single name multiple values are possible
 *
 * The reason for the different formats are the way how multiple headers are set and get in node:
 * get "a;b;c", set: [a,b,c]
 */
module.exports = extend( function F( obj, options ){
	
	options = options.map ? options : {map:options}; // if called with only a map
	
	var
		log     = options.log,
		map     = options.map,
		create  = options.create,
		new_obj = {},
		new_data,
		rule;
	
	if(map) for( var p in obj ){
		var
			matched = false,
			data    = { name: p, value: obj[p] };
		
		for(var i=0, l=map.length; i<l && !matched; i++){
			rule=map[i];
			
			matched = F.matches(data, rule, 'name') && F.matches(data, rule, 'value');
			if(matched){
				try{
					new_data = F.replace( data, rule, 'name');
					new_data = new_data ? F.replace( data, rule, 'value', new_data): null;
					
					if( new_data ){
						new_obj[new_data.name]=new_data.value;
					}
				}
				finally{
					F.log(log, data, rule, new_data);
				}
			}
		}
	}
	if(create) for(var cri=0, crl=create.length; cri<crl; cri++){
		new_data = create[cri];
		
		if(new_data.name && 'value' in new_data ){
			new_obj[new_data.name]=new_data.value;
		}
	}
	return new_obj;
},{
	matches: function(data,rule,property){
		var tmp;
		return !(property in rule) || ((tmp=rule[property]) && (tmp=tmp.match) && tmp.test(data[property]));
	},
	replace: function(data,rule,property,new_data){
		var
			value         = data[property],
			property_rule = rule[property];
		
		new_data = new_data || {};
		
		if (!property_rule || property_rule.copy){
			if(property in data){
				new_data[property] = value;
			}
		} else if (property_rule.replace){ // new value
			if(value && Array.isArray(value)) {
				new_data[property] = [];
				for(var i = 0; i<value.length; i++) {
					new_data[property].push(( value[i] ? '' + value[i] : '' ).replace(property_rule.match, property_rule.replace));
				}
			} else {
				new_data[property] = ( value ? '' + value : '' ).replace(property_rule.match, property_rule.replace);
			}
		} else {
			new_data = null;
		}
		
		if (rule.status) throw rule.status;
		
		return new_data;
	},
	set:function(data,rule,property,new_data){ // for date/boolean values (false means removal)
		new_data = new_data || {};
		
		if(property in data){
			new_data[property] = data[property];
		}
		if( property in rule ){
			if( rule[property] ){
				new_data[property] = rule[property];
			} else {
				delete new_data[property];
			}
		}
	},
	log:function(log, from, rule, to ){
		var entry = extend({/*level:'debug'*/ message: 'map rule matched'},rule.log||{});
		log && log[entry.level] && log[entry.level](entry.message, {from:from, to:to, rule:rule});
	}
});
