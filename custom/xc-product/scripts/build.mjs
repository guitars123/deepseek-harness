import {build} from 'rolldown';import {mkdir,writeFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
/** Build the isolated client with only native shared modules externalized. */
await mkdir(new URL('../plugins/xc-ui/lib/',import.meta.url),{recursive:true});
const result=await build({input:fileURLToPath(new URL('../plugins/xc-ui/client.jsx',import.meta.url)),transform:{define:{'process.env.NODE_ENV':'"production"'}},external:['react','react-dom','react/jsx-runtime','@deepseek-ai/dsh-client-ui-primitives'],output:{format:'cjs',exports:'named',codeSplitting:false}});
const chunk=result.output.find(item=>item.type==='chunk');if(!chunk)throw new Error('Client bundle missing');
const registration='window.__ModuleLoader__.load({id:"@xc/dsh-product-ui",factory:function(require){var module={exports:{}};var exports=module.exports;\n'+chunk.code+'\nreturn module.exports;}});\n';
await writeFile(new URL('../plugins/xc-ui/lib/client.js',import.meta.url),registration);
console.log('Built @xc/dsh-product-ui ('+registration.length+' bytes)');
