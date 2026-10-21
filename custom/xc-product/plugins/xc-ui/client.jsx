import React,{useEffect,useRef,useState} from 'react';
import {init,use} from 'echarts/core';import {LineChart} from 'echarts/charts';import {GridComponent,TooltipComponent,AriaComponent} from 'echarts/components';import {SVGRenderer} from 'echarts/renderers';
import {Button,Modal,Menu} from '@deepseek-ai/dsh-client-ui-primitives';
import {zh,en,common} from './locales.mjs';import {styles} from './styles.mjs';
use([LineChart,GridComponent,TooltipComponent,AriaComponent,SVGRenderer]);
export const inject=['slots','locale'];
/** @param path Product API path. @param method HTTP method. @returns Safe account data. */
async function request(path,method='GET'){const response=await fetch('/xc/api/'+path,{method,headers:method==='POST'?{'Content-Type':'application/json'}:{}});if(response.status===401){location.assign('/xc/login');throw new Error(zh.expired);}const value=await response.json();if(!response.ok)throw new Error(value.error ?? zh.failed);return value;}
/** @param value Server numeric field. @returns Formatted number or unavailable marker. */
function numeric(value,digits=2){const number=typeof value==='number'?value:typeof value==='string'&&value.trim()?Number(value):NaN;return Number.isFinite(number)?number.toLocaleString(undefined,{minimumFractionDigits:digits,maximumFractionDigits:digits}):'—';}
/** @param props Product icon. @returns Existing brand artwork. */
function BrandMark(){return <img className="xc-brand" src="/xc/brand.png" alt=""/>;}
/** @param props Account data, labels and refresh action. @returns Real account dashboard. */
function Dashboard({data,error,busy,refresh,t}){
 const chart=useRef(null);const instance=useRef(null);
 useEffect(()=>{if(!chart.current||!data)return;const dark=window.matchMedia('(prefers-color-scheme: dark)').matches;const graph=init(chart.current,dark?'dark':undefined,{renderer:'svg'});instance.current=graph;graph.setOption({backgroundColor:'transparent',aria:{enabled:true},tooltip:{trigger:'axis'},grid:{top:20,left:50,right:20,bottom:35},xAxis:{type:'category',data:data.trend.map(item=>item.date)},yAxis:{type:'value'},series:[{name:t('cost'),type:'line',smooth:true,data:data.trend.map(item=>item.actual_cost),lineStyle:{color:'#6e8d79'},itemStyle:{color:'#6e8d79'},areaStyle:{opacity:.08}}]});const observer=new ResizeObserver(()=>graph.resize());observer.observe(chart.current);return()=>{observer.disconnect();graph.dispose();instance.current=null;};},[data,t]);
 const profile=data?.profile;const stats=data?.stats;
 return <section className="xc-account"><div className="xc-heading"><div><h2>{t('account')}</h2><p>{profile?.email ?? t('description')}</p></div><Button onClick={refresh} disabled={busy}>{t('refresh')}</Button></div>{error&&<p role="alert" className="xc-error">{error}</p>}{!data&&busy?<div className="xc-loading" role="status" aria-label={t('loading')}/>:<><div className="xc-cards">{[['balance',profile?.balance,2],['today',stats?.today_actual_cost,4],['requests',stats?.today_requests,0],['tokens',stats?.today_tokens,0]].map(([key,value,digits])=><div className="xc-card" key={key}><span>{t(key)}</span><strong>{numeric(value,digits)}</strong></div>)}</div><dl className="xc-fields">{[['name',profile?.username ?? profile?.name],['email',profile?.email],['concurrency',profile?.concurrency],['total',stats?.total_requests]].map(([key,value])=><div key={key}><dt>{t(key)}</dt><dd>{value ?? '—'}</dd></div>)}</dl><h3>{t('trend')}</h3><div ref={chart} className="xc-chart" role="img" aria-label={t('trend')}/><h3>{t('models')}</h3><div className="xc-table"><table><thead><tr><th>{t('model')}</th><th>{t('requests')}</th><th>{t('cost')}</th></tr></thead><tbody>{data?.models.map((model,index)=><tr key={model.model ?? index}><td>{model.model ?? model.model_name ?? '—'}</td><td>{numeric(model.requests ?? model.request_count,0)}</td><td>{numeric(model.actual_cost,4)}</td></tr>)}</tbody></table></div></>}</section>;
}
/** @param props Injected account state and translations. @returns Account settings page. */
function AccountSection(props){const data=props.useAccount();return <Dashboard {...data} refresh={props.refresh} t={props.t}/>;}
/** @param props Native launcher geometry with account state. @returns Product account launcher and menu. */
function AccountMenu({wide,settingsOpen,openSettings,useAccount,refresh,t}){
 const {data,error,busy}=useAccount();const [open,setOpen]=useState(false);const [panel,setPanel]=useState(false);const [logoutError,setLogoutError]=useState();const trigger=useRef(null);const profile=data?.profile;const name=profile?.username ?? profile?.name ?? profile?.email ?? t('account');
 useEffect(()=>{if(settingsOpen)setOpen(false);},[settingsOpen]);
 const anchor=<button ref={trigger} type="button" className="xc-launcher" aria-label={name} aria-haspopup="menu" aria-expanded={open} onClick={()=>{setOpen(value=>!value);if(!data)void refresh();}}><span className="xc-avatar">{name.slice(0,1).toUpperCase()}{profile?.avatar_url&&<img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" onError={event=>{event.currentTarget.style.display='none';}}/>}</span>{wide&&<><span className="xc-name">{name}</span><span aria-hidden="true">⌃</span></>}</button>;
 return <><Menu open={open} side="top" portal autoFocus anchor={anchor} onClose={()=>setOpen(false)} listClassName="xc-native-menu" items={[{type:'label',id:'identity',text:name+(profile?.email?' · '+profile.email:'')},{id:'balance',label:<span className="xc-metric"><span>{t('balance')}</span><span>{numeric(profile?.balance)}</span></span>},{id:'today',label:<span className="xc-metric"><span>{t('today')}</span><span>{numeric(data?.stats.today_actual_cost,4)}</span></span>},{type:'separator',id:'separator'},{id:'settings',label:t('settings')},{id:'logout',label:t('logout')}]} onSelect={id=>{setOpen(false);if(id==='settings')openSettings();else if(id==='logout')void request('logout','POST').then(()=>location.replace('/xc/login')).catch(error=>setLogoutError(error.message));else{setPanel(true);void refresh();}}}/>{logoutError&&<p role="alert" className="xc-error">{logoutError}</p>}{panel&&<Modal open title={t('account')} closeLabel={t('close')} onClose={()=>setPanel(false)} className="xc-modal"><Dashboard data={data} error={error} busy={busy} refresh={refresh} t={t}/></Modal>}</>;
}
/** @param ctx Native client plugin context. */
export function apply(ctx){
 ctx.effect(()=>ctx.locale.register('xc.account',{zh:{...zh,...common.zh},en:{...en,...common.en}}));const t=ctx.locale.bind('xc.account');
 let snapshot={data:undefined,busy:false,error:undefined};const listeners=new Set();let pending;let disposed=false;
 /** @param patch State update. */
 function publish(patch){snapshot={...snapshot,...patch};for(const listener of listeners)listener();}
 /** @returns Current account dashboard subscription. */
 function useAccount(){return React.useSyncExternalStore(listener=>{listeners.add(listener);return()=>listeners.delete(listener);},()=>snapshot);}
 /** @returns Refreshed real account dashboard. */
 function refresh(){if(pending)return pending;publish({busy:true,error:undefined});pending=request('overview').then(data=>{if(!disposed)publish({data});}).catch(error=>{if(!disposed)publish({error:error.message});}).finally(()=>{pending=undefined;if(!disposed)publish({busy:false});});return pending;}
 ctx.effect(()=>{const tag=document.createElement('style');tag.dataset.plugin='@xc/dsh-product-ui';tag.textContent=styles;document.head.append(tag);return()=>tag.remove();});
 ctx.effect(()=>()=>{disposed=true;listeners.clear();});
 const props=()=>({useAccount,refresh});
 ctx.slots.inject('settings.launcher',()=>ctx.slots.register({name:'settings.launcher',locale:'xc.account',inject:props},AccountMenu));
 ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:'account',order:-10,label:()=>t('account'),locale:'xc.account',inject:props},AccountSection));
 ctx.slots.inject('sidebar.brand.mark',()=>ctx.slots.register({name:'sidebar.brand.mark'},BrandMark));
 ctx.slots.inject('sidebar.brand.name',()=>ctx.slots.register({name:'sidebar.brand.name'},()=> <span>胥瓷智库</span>));
 ctx.slots.inject('conversation.hero.brand.mark',()=>ctx.slots.register({name:'conversation.hero.brand.mark'},BrandMark));
 void refresh();
}
