import {request} from 'node:http';
import {connect} from 'node:net';
/** @param req Browser request. @param instance Private DSH instance. @returns Internal request headers. */
function headersFor(req,instance){const headers={...req.headers,host:new URL(instance.url).host,cookie:instance.cookie};delete headers.authorization;delete headers['x-forwarded-for'];delete headers['x-forwarded-host'];delete headers['x-forwarded-proto'];if(headers.origin)headers.origin=instance.url;delete headers['sec-fetch-site'];return headers;}
/** @param req Authenticated request. @param res Browser response. @param instance Private DSH instance. */
export function proxyHttp(req,res,instance){
 const upstream=request(new URL(req.url,instance.url),{method:req.method,headers:headersFor(req,instance)},response=>{const headers={...response.headers};delete headers['set-cookie'];headers['cache-control']='no-store';if(headers.location){try{const location=new URL(headers.location,instance.url);if(location.origin===instance.url)headers.location=location.pathname+location.search+location.hash;}catch{headers.location='/';}}res.writeHead(response.statusCode,headers);response.pipe(res);response.on('error',()=>res.destroy());});
 upstream.on('error',()=>{if(!res.headersSent){res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'工作区连接失败，请刷新重试'}));}else res.destroy();});req.on('aborted',()=>upstream.destroy());res.on('close',()=>upstream.destroy());req.pipe(upstream);
}
/** @param req Authenticated upgrade. @param socket Browser socket. @param head Buffered bytes. @param instance Private DSH instance. */
export function proxyUpgrade(req,socket,head,instance){
 const target=new URL(instance.url);const upstream=connect(Number(target.port),target.hostname,()=>{const headers=headersFor(req,instance);upstream.write(req.method+' '+req.url+' HTTP/1.1\r\n'+Object.entries(headers).filter(([,value])=>value!==undefined).map(([key,value])=>key+': '+value).join('\r\n')+'\r\n\r\n');if(head.length)upstream.write(head);socket.pipe(upstream);upstream.pipe(socket);});instance.sockets.add(socket);socket.on('close',()=>{instance.sockets.delete(socket);upstream.destroy();});socket.on('error',()=>upstream.destroy());upstream.on('error',()=>socket.destroy());upstream.on('close',()=>socket.destroy());
}
