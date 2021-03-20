import http from 'http'
import httpProxy from 'http-proxy'
import { handleBuffer } from './handleBuffer';
import {Configs} from './config'

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

// 替换开发域名与实际环境域名
function replaceHost(str: string, tgtToDev = false) {
  const src: string = !tgtToDev ? devUrl : tgtUrl
  const tgt = tgtToDev ? devUrl : tgtUrl
  const srcReg = new RegExp(src.split('').map(x => (x==='.' ? '\\.' : x)).join(''), 'ig')
  return str.replace(srcReg, tgt)
}

// 拦截发向环境的请求，将header和path替换为环境域名
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

// 获取、转发实际请求结果
proxy.on('proxyRes', function (proxyRes, oreq, res) {
  let body: any = [];

  proxyRes.on('data', function (chunk) {
      body.push(chunk);
  });
  proxyRes.on('end', function () {
    
    // 将header中的环境域名替换为开发域名
    const headers = proxyRes.headers
    for (let key in headers) {
      const v = headers[key]
      res.setHeader(key, typeof v === 'string'
        ? replaceHost(v, true)
        : typeof v === 'number'
        ? v
        : v.map(s=>replaceHost(s, true)))
    }

    // 设置代理请求的状态
    res.statusCode = proxyRes.statusCode
    res.statusMessage = proxyRes.statusMessage

    // 将body中的环境域名替换为开发域名
    body = Buffer.concat(body)
    const byContentType = 
      /(text)|(html)|(json)|(script)|(xml)/i.test(proxyRes.headers['content-type'] || '')
      && !/(image)/i.test(proxyRes.headers['content-type'] || '')
    const byUrl = /\.((js)|(html))/.test(oreq.url)
    if (byContentType || byUrl) {
      // 解析html/json/script中的内容，替换内容
      body = handleBuffer(body, proxyRes.headers['content-encoding']).toString();
      body = replaceHost(body, true)
      body = Buffer.from(body, 'utf-8')
      res.setHeader('content-encoding', 'identity') // 不压缩
    }
    // 调整部分返回头
    res.removeHeader('transfer-encoding')
    res.removeHeader('content-length')
    res.setHeader('content-length', body.length)
    
    res.end(body);
  });
});

var server = http.createServer(function(oreq, res) {

  console.log('incoming req', oreq.url, oreq.headers.host)

  const target = 'http://'+ replaceHost(oreq.headers.host)

  proxy.web(oreq, res, {
    target: 'http://127.0.0.1:8899',
    selfHandleResponse : true,
    ws: true,
    toProxy: true
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

console.log("listening on port " + Configs.port)
server.listen(Configs.port);