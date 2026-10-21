import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {configuration} from './config.mjs';import {login,overview} from './account.mjs';import {SessionStore} from './store.mjs';import {Instances} from './instances.mjs';import {proxyHttp,proxyUpgrade} from './proxy.mjs';
/** @param req Browser request. @returns Opaque session cookie. */
export function sessionToken(req){return req.headers.cookie?.split(';').map(part=>part.trim()).find(part=>part.startsWith('xc-session='))?.slice(11);}
/** @param req Browser request. @param config Public origin. @returns Whether browser and Host markers match. */
export function trusted(req,config){if(req.headers.host!==new URL(config.publicUrl).host)return false;if(req.headers.origin && req.headers.origin!==config.publicUrl)return false;return req.headers['sec-fetch-site']!=='cross-site';}
/** @param req JSON request. @returns Parsed input under 16 KiB. */
async function body(req){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>16384)throw Object.assign(new Error('请求内容过大'),{status:413});chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw Object.assign(new Error('请求内容无效'),{status:400});}}
/** @param res Response. @param status Status. @param value Safe response fields. */
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
/** @param config Validated config. @param dependencies Optional adapters for integration tests. @returns Product gateway and lifecycle owners. */
export async function createGateway(config,dependencies={}){
 const store=dependencies.store ?? await new SessionStore(config.dataDir,config.sessionDays).open();const instances=dependencies.instances ?? new Instances(config);const authenticate=dependencies.login ?? login;const readOverview=dependencies.overview ?? overview;const attempts=new Map();
 const server=createServer(async(req,res)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
 try{
  if(!trusted(req,config))return json(res,403,{error:'请求来源不受信任'});
  const url=new URL(req.url,config.publicUrl);const token=sessionToken(req);const account=store.get(token);
  if(req.method==='POST' && req.headers.origin!==config.publicUrl)return json(res,403,{error:'请求来源不受信任'});
  if(url.pathname==='/xc/api/login' && req.method==='POST'){
   const address=req.socket.remoteAddress;const attempt=attempts.get(address) ?? {count:0,until:Date.now()+60000};if(attempt.until<Date.now()){attempt.count=0;attempt.until=Date.now()+60000;}attempt.count++;attempts.set(address,attempt);if(attempt.count>10)return json(res,429,{error:'登录尝试过多，请稍后重试'});
   const verified=await authenticate(config.accountUrl,await body(req));await instances.get(verified);const created=await store.create(verified);if(token)await store.remove(token);res.setHeader('Set-Cookie','xc-session='+created+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+config.sessionDays*86400+(config.publicUrl.startsWith('https:')?'; Secure':''));return json(res,200,{ok:true});
  }
  if(url.pathname==='/xc/api/logout' && req.method==='POST'){if(account)instances.revoke(account.id);await store.remove(token);res.setHeader('Set-Cookie','xc-session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'+(config.publicUrl.startsWith('https:')?'; Secure':''));return json(res,200,{ok:true});}
  if(url.pathname==='/xc/api/overview' && req.method==='GET'){if(!account)return json(res,401,{error:'请先登录'});return json(res,200,await readOverview(config.accountUrl,account.token));}
  if(url.pathname==='/xc/login' && req.method==='GET'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'"});return res.end(await readFile(new URL('../public/login.html',import.meta.url)));}
  if(url.pathname==='/xc/brand.png' && req.method==='GET'){if(!account)return json(res,401,{error:'请先登录'});res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'no-store'});return res.end(await readFile(new URL('../public/brand.png',import.meta.url)));}
  if(['/xc/login.js','/xc/login.css'].includes(url.pathname) && req.method==='GET'){res.writeHead(200,{'Content-Type':url.pathname.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8','Cache-Control':'no-store'});return res.end(await readFile(new URL('../public/'+url.pathname.split('/').pop(),import.meta.url)));}
  if(!account){if(req.method==='GET' && req.headers.accept?.includes('text/html')){res.writeHead(302,{Location:'/xc/login','Cache-Control':'no-store'});return res.end();}return json(res,401,{error:'请先登录'});}
  // Never forward external launch-token requests or operator registration.
  if(url.pathname==='/connect'||url.searchParams.has('token'))return json(res,403,{error:'不支持此访问方式'});
  if(url.pathname.startsWith('/xc/'))return json(res,404,{error:'页面不存在'});
  proxyHttp(req,res,await instances.get(account));
 }catch(error){json(res,error.status ?? 503,{error:error.status ? error.message : '服务暂时不可用，请稍后重试'});}});
 server.on('upgrade',(req,socket,head)=>{const account=store.get(sessionToken(req));if(!trusted(req,config)||!account){socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');return;}void instances.get(account).then(instance=>{if(!store.get(sessionToken(req)))return socket.destroy();proxyUpgrade(req,socket,head,instance);}).catch(()=>socket.destroy());});
 server.requestTimeout=300000;server.headersTimeout=30000;
 return {server,store,instances,async close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await instances.close();}};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){if(existsSync('.env'))process.loadEnvFile('.env');const config=configuration();const gateway=await createGateway(config);gateway.server.listen(config.port,config.host,()=>console.log('胥瓷智库: '+config.publicUrl));let stopping=false;const stop=()=>{if(stopping)return;stopping=true;void gateway.close().then(()=>process.exit(0));};process.on('SIGINT',stop);process.on('SIGTERM',stop);}
