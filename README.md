# x-middleware-proxy

[Build Status](https://travis-ci.org/x-component/x-middleware-proxy.png?v1.0.0)](https://travis-ci.org/x-component/x-middleware-proxy)

- [./index.js](#indexjs) 
- [./location.js](#locationjs) 
- [./map-cookie.js](#map-cookiejs) 
- [./map-header.js](#map-headerjs) 
- [./map.js](#mapjs) 
- [./proxy-forward.js](#proxy-forwardjs) 
- [./proxy-status.js](#proxy-statusjs) 
- [./proxy.js](#proxyjs) 
- [./relativize.js](#relativizejs) 
- [./relativize2.js](#relativize2js) 
- [./test/config.js](#testconfigjs) 

# ./index.js




# ./location.js

  - [url](#url)

## url

  location url reverse rewrite for the location header
   this uses request.proxy which  contains the proxy target config
  
   reverse rewrite example 
   input location url = http://cmsserver:port/prefix/foo/bar;session=XYZ?f=1&b=2
   result url shoud be  = http://myname:myport/mount/foo/bar;session=ABC?f=1&b=2

# ./map-cookie.js

  - [extend](#extend)

## extend

  this middleware maps the Cookie header for requests and the Set-Cookie header for response
  the mapping is defined by options

# ./map-header.js

  - [extend](#extend)

## extend

  

# ./map.js

  - [message](#message)

## message

  level:'debug'

# ./proxy-forward.js

  - [callback](#callback)
  - [undefined.request()](#undefinedrequest)
  - [undefined.response()](#undefinedresponse)

## callback

  this middleware prepares the internal proxy request and forwards the intenral proxy response

## undefined.request()

  Prepares the inner proxy request by creating an object with all related reuqest data.
  
   The existing body of the outer request will be added to the proxy request.

## undefined.response()

  Forwards the existing inner response, if it is not of content-type html or text.
   Otherwise statusCode and body of inner response will be stored in the outer response for further transformation.

# ./proxy-status.js




# ./proxy.js

  - [callback](#callback)

## callback

  read content from CMS

# ./relativize.js

  - [url](#url)

## url

  adapt internal absolute urls to relative urls

# ./relativize2.js

  - [url](#url)

## url

  adapt internal absolute urls to relative urls

# ./test/config.js



