import http from 'http'
import httpProxy from 'http-proxy'
import { handleBuffer } from './handleBuffer';

//
// Create a proxy server with custom application logic
//
var proxy = httpProxy.createProxyServer({ws:true, changeOrigin: true});

// To modify the proxy connection before data is sent, you can listen
// for the 'proxyReq' event. When the event is fired, you will receive
// the following arguments:
// (http.ClientRequest proxyReq, http.IncomingMessage req,
//  http.ServerResponse res, Object options). This mechanism is useful when
// you need to modify the proxy request before the proxy connection
// is made to the target.
//
// proxy.on('proxyReq', function(proxyReq, req, res, options) {
//   proxyReq.setHeader('dev-host-proxy', 'true');
// });
const m16 = 'yf-m16.tcecqpoc.fsphere.cn'
const m17 = 'yf-m17.tcecqpoc.fsphere.cn'
const devUrl = 'dev.tce.com'
const tgtUrl = m16

function replaceHost(str: string, tgtToDev = false) {
  const src: string = !tgtToDev ? devUrl : tgtUrl
  const tgt = tgtToDev ? devUrl : tgtUrl
  const srcReg = new RegExp(src.split('').map(x => (x==='.' ? '\\.' : x)).join(''), 'ig')
  return str.replace(srcReg, tgt)
}

proxy.on('proxyReq', function(proxyReq, oreq, res, options) {
  console.log(proxyReq.path)
  proxyReq.path = replaceHost(proxyReq.path)
  for (let key in oreq.headers) {
    const v = oreq.headers[key]
    const newV = typeof v === 'string' ? replaceHost(v) : v.map(s=>replaceHost(s))
    // console.log(key, newV)
    proxyReq.setHeader(key, newV);
  }
});

proxy.on('proxyRes', function (proxyRes, oreq, res) {
  let body: any = [];

  proxyRes.on('data', function (chunk) {
    // console.log('data', chunk.length, Buffer.isEncoding('utf-8'))
    // const decode = Buffer.from(, 'utf-8')
      body.push(chunk);
  });
  proxyRes.on('end', function () {
    
    const headers = proxyRes.headers
    // console.log('headers', oreq.url,proxyRes.headers, res.statusCode, headers)
    for (let key in headers) {
      const v = headers[key]
      res.setHeader(key, typeof v === 'string'
        ? replaceHost(v, true)
        : typeof v === 'number'
        ? v
        : v.map(s=>replaceHost(s, true)))
    }
    res.statusCode = proxyRes.statusCode
    res.statusMessage = proxyRes.statusMessage
    body = Buffer.concat(body)
    const byContentType = 
      /(text)|(html)|(json)|(script)|(xml)/i.test(proxyRes.headers['content-type'] || '')
      && !/(image)/i.test(proxyRes.headers['content-type'] || '')
    const byUrl = /\.((js)|(html))/.test(oreq.url)
    if (byContentType || byUrl) {
      body = handleBuffer(body, proxyRes.headers['content-encoding']).toString();
      // console.log("res from proxied server:", body);
      body = replaceHost(body, true)
      body = Buffer.from(body, 'utf-8')
      res.setHeader('content-encoding', 'identity') // 不压缩
    }
    res.removeHeader('transfer-encoding')
    res.removeHeader('content-length')
    res.setHeader('content-length', body.length)
    
    res.end(body);
  });
});

var server = http.createServer(function(oreq, res) {
  // You can define here your custom logic to handle the request
  // and then proxy the request.
  // const cookie = req.headers.cookie
  // const host = 

  
  console.log('incoming req', oreq.url)
  const x = oreq.socket
  console.log(oreq.headers.host, oreq.headers.referer)

  // Object.keys(req.headers)
  // res.write('123')
  // res.end()
  // oreq.url = replaceHost(oreq.url)

  const host = new URL(replaceHost(oreq.url)).origin
  console.log(host)
  proxy.web(oreq, res, {
    target: host,
    selfHandleResponse : true,
    ws: true
  });
});

server.on('upgrade', function (req, socket, head) {
  console.log('ws is here')
  proxy.ws(req, socket, head);
});

server.on('error', (err) => {
  console.log('server error', err)
})

proxy.on('error', (err) => {
  if ((err as any).code === 'ECONNRESET') {
    console.log('socket hang up ECONNRESET')
  } else {
    console.log('proxy error', err.name, err.message, (err as any).code, err)
  }
})

console.log("listening on port 5053")
server.listen(5053);