const {app,BrowserWindow,shell}=require('electron');
const {readFileSync}=require('node:fs');const {join}=require('node:path');
/** @description Start the remote-only desktop window. */
function openWindow(){
 const config=JSON.parse(readFileSync(join(app.isPackaged ? process.resourcesPath : __dirname,'config.json'),'utf8'));
 const target=new URL(process.env.XC_DESKTOP_URL || config.url);
 if(target.protocol!=='https:' && !['127.0.0.1','localhost'].includes(target.hostname)) throw new Error('Desktop server requires HTTPS');
 const win=new BrowserWindow({width:1280,height:840,minWidth:760,minHeight:540,title:'胥瓷智库',webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
 win.webContents.setWindowOpenHandler(({url})=>{const next=new URL(url);if(['https:','http:'].includes(next.protocol)) void shell.openExternal(next.href);return {action:'deny'};});
 win.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==target.origin) event.preventDefault();});
 win.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
 void win.loadURL(target.href);
}
app.whenReady().then(()=>{openWindow();app.on('activate',()=>{if(!BrowserWindow.getAllWindows().length)openWindow();});});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
