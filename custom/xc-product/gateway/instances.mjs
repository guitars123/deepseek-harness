import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
/** @param config Deployment config. @param account Verified account. @returns Native profile overlay with product plugins. */
export function overlay(config,account) {
 const directory=join(config.dataDir,'users',account.id);
 const plugin=fileURLToPath(new URL('../plugins/xc-ui/index.mjs',import.meta.url));
 const models=[...account.models].sort((left,right)=>{
  const preferred='gpt-6.1-sol';
  return Number(right.id===preferred)-Number(left.id===preferred);
 });
 return [
 {id:'ui-settings-account',disabled:true},{id:'ui-message-feedback',disabled:true},{id:'ui-brand-official',disabled:true},
 {id:'agent-default-model',config:{provider:'xc-account',model:models[0]?.id}},
 {id:'llm-pi-ai',config:{providers:{'xc-account':{displayName:'胥瓷智库',api:'openai-responses',baseURL:config.accountUrl+'/v1',apiKeyEnv:'XC_MODEL_KEY',models}}}},
 {id:'workspace-controller',config:{documentsDirectory:join(directory,'documents'),documentsLookupTimeoutMs:10000}},
 {insert:[{id:'xc-product-ui',name:plugin}]}
 ];
}
/** One native DSH process and home per verified account. */
export class Instances {
 /** @param config Deployment configuration. */
 constructor(config){this.config=config;this.instances=new Map();this.pending=new Map();this.stopping=false;}
 /** @param account Verified account. @returns Ready private DSH instance. */
 async get(account){
  if(this.stopping)throw new Error('服务正在关闭');
  const pending=this.pending.get(account.id);if(pending)return pending;
  const live=this.instances.get(account.id);if(live?.child.exitCode===null && live.url)return live;
  if(this.instances.size+this.pending.size>=this.config.maxInstances)throw Object.assign(new Error('服务容量已满，请稍后重试'),{status:503});
  const launch=this.start(account);this.pending.set(account.id,launch);
  try{return await launch;}finally{this.pending.delete(account.id);}
 }
 /** @param account Verified account. @returns Ready instance with a server-only DSH cookie. */
 async start(account){
  const directory=join(this.config.dataDir,'users',account.id);const workspace=join(directory,'documents','deepseek-harness','default-workspace');
  await mkdir(workspace,{recursive:true,mode:0o700});await mkdir(join(directory,'home'),{recursive:true,mode:0o700});
  const patch=join(directory,'product.overlay.json');await writeFile(patch,JSON.stringify(overlay(this.config,account)),{mode:0o600});
  const child=spawn(process.execPath,[resolve(this.config.dshRoot,'apps/cli/lib/bin.js'),'--profile','web','--patch',patch,'--host','127.0.0.1','--port','0','--no-open'],{cwd:workspace,env:{...process.env,DSH_HOME:join(directory,'home'),XC_MODEL_KEY:account.key},stdio:['ignore','pipe','pipe'],windowsHide:true});
  let diagnostic='';
  child.stderr.on('data',chunk=>{diagnostic=(diagnostic+chunk.toString()).slice(-16000);});
  const record={child,cookie:'',url:undefined,sockets:new Set()};this.instances.set(account.id,record);
  child.once('exit',()=>{if(this.instances.get(account.id)===record)this.instances.delete(account.id);for(const socket of record.sockets)socket.destroy();});
  try{
   const launch=await new Promise((resolveReady,reject)=>{let buffer='';const timer=setTimeout(()=>finish(new Error('工作区启动超时，请检查服务器日志')),this.config.startupTimeout);const onError=()=>finish(new Error('工作区启动失败'));const onExit=()=>finish(new Error('工作区进程已退出，请先完成原生 DSH 构建'));const onData=chunk=>{buffer=(buffer+chunk.toString()).slice(-32768);const match=buffer.replace(/\x1b\[[0-9;]*m/gu,'').match(/dsh web: (http:\/\/127\.0\.0\.1:\d+\/[^\s]*)/u);if(match)finish(undefined,match[1]);};const finish=(error,url)=>{clearTimeout(timer);child.stdout.off('data',onData);child.off('error',onError);child.off('exit',onExit);error?reject(error):resolveReady(url);};child.stdout.on('data',onData);child.once('error',onError);child.once('exit',onExit);});
   child.stderr.resume();child.stdout.resume();
   const response=await fetch(launch,{redirect:'manual',signal:AbortSignal.timeout(20000)});
   const cookies=response.headers.getSetCookie();if(response.status!==303&&response.status!==302)throw new Error('工作区认证初始化失败');
   if(!cookies.length)throw new Error('工作区认证 Cookie 缺失');record.cookie=cookies.map(value=>value.split(';')[0]).join('; ');record.url=new URL(launch).origin;
   return record;
  }catch(error){child.kill();this.instances.delete(account.id);const safe=diagnostic.replaceAll(account.key,'[redacted]').replaceAll(account.token,'[redacted]').replace(/token=[^\s&]+/gu,'token=[redacted]');if(safe)console.error('DSH startup failed:',safe);throw error;}
 }
 /** @param accountId Account whose upgraded connections must close. */
 revoke(accountId){const record=this.instances.get(accountId);if(record)for(const socket of record.sockets)socket.destroy();}
 /** @returns After child processes terminate. */
 async close(){this.stopping=true;await Promise.allSettled([...this.pending.values()]);await Promise.all([...this.instances.values()].map(record=>new Promise(resolveExit=>{if(record.child.exitCode!==null)return resolveExit();record.child.once('exit',resolveExit);record.child.kill();setTimeout(()=>record.child.kill('SIGKILL'),5000).unref();})));}
}
