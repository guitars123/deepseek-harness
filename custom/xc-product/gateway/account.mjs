import { createHash } from 'node:crypto';
/** @param value JSON API envelope. @returns Inner API value. */
export function unwrap(value) { return value?.data ?? value; }
/** @param server Account service. @param id Verified account ID. @returns Stable private directory key. */
export function accountId(server, id) { if (id === undefined || id === null || id === '') throw new Error('Account ID missing'); return createHash('sha256').update(server + '#' + String(id)).digest('hex'); }
/** @param server Account service URL. @param path API path. @param token Account token. @param body Optional JSON input. @returns Parsed API data. */
export async function accountRequest(server, path, token, body) {
 const response = await fetch(server + '/api/v1' + path, { method: body ? 'POST':'GET', headers:{...(token ? {Authorization:'Bearer '+token}:{}), ...(body ? {'Content-Type':'application/json'}:{})}, ...(body ? {body:JSON.stringify(body)}:{}), signal:AbortSignal.timeout(20000) });
 if (!response.ok) throw Object.assign(new Error(response.status === 401 ? '登录已过期，请重新登录' : '账号服务暂时不可用'), {status:response.status === 401 ? 401 : 502});
 const value = await response.json(); if (value.code !== undefined && value.code !== 0 && value.code !== 200) throw Object.assign(new Error('账号服务拒绝了请求'),{status:400}); return unwrap(value);
}
/** @param server Account service URL. @param input Login form. @returns Verified user, token, key and model catalog. */
export async function login(server, input) {
 if (typeof input.email !== 'string' || typeof input.password !== 'string' || !input.email || !input.password) throw Object.assign(new Error('请输入邮箱和密码'),{status:400});
 const result = await accountRequest(server,'/auth/login',undefined,{email:input.email,password:input.password});
 const token = result.access_token ?? result.token; if (typeof token !== 'string') throw new Error('账号服务没有返回登录令牌');
 const me = await accountRequest(server,'/auth/me',token); const profile = me.user ?? me;
 const keys = await accountRequest(server,'/keys?page=1&page_size=100&status=active',token);
 const key = keys.items?.find(item=>item.status === 'active')?.key;
 if (typeof key !== 'string' || !key) throw Object.assign(new Error('账号没有可用 API 密钥，请在控制台创建后重试'),{status:400});
 const response = await fetch(server+'/v1/models',{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(20000)});
 if (!response.ok) throw new Error('模型列表读取失败'); const modelResult = await response.json();
 const models = (modelResult.data ?? []).filter(model=>typeof model.id === 'string').map(model=>({id:model.id,name:model.name ?? model.id}));
 if (!models.length) throw new Error('账号没有可用模型');
 return {id:accountId(server,profile.id),profile,token,key,models};
}
/** @param server Account service URL. @param token Account token. @returns Dashboard fields without credentials. */
export async function overview(server, token) {
 const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date());
 const start = new Date(Date.now()-6*86400000); const first = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(start);
 const query = new URLSearchParams({start_date:first,end_date:today,timezone:'Asia/Shanghai'});
 const [me,stats,trend,models] = await Promise.all(['/auth/me','/usage/dashboard/stats','/usage/dashboard/trend?'+query,'/usage/dashboard/models?'+query].map(path=>accountRequest(server,path,token)));
 const user=me.user ?? me; const profile=Object.fromEntries(['id','email','username','name','balance','frozen_balance','concurrency','created_at','avatar_url'].filter(key=>user[key]!==undefined).map(key=>[key,user[key]]));
 return {profile,stats,trend:trend.trend ?? [],models:models.models ?? []};
}
