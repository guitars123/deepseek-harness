import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { join } from 'node:path';
/** Encrypted durable product sessions; plaintext passwords are never stored. */
export class SessionStore {
 /** @param directory Private data directory. @param days Absolute session lifetime. */
 constructor(directory,days) { this.directory=directory; this.days=days; this.records={}; this.queue=Promise.resolve(); }
 /** @returns Initialized store. */
 async open() {
  await mkdir(this.directory,{recursive:true,mode:0o700}); const path=join(this.directory,'session.key');
  try { this.key=await readFile(path); } catch(error) { if(error.code!=='ENOENT') throw error; const key=randomBytes(32); try { await writeFile(path,key,{flag:'wx',mode:0o600}); this.key=key; } catch(race) { if(race.code!=='EEXIST') throw race; this.key=await readFile(path); } }
  if(this.key.length!==32) throw new Error('Invalid session encryption key');
  try { const raw=JSON.parse(await readFile(join(this.directory,'sessions.json'),'utf8')); const decipher=createDecipheriv('aes-256-gcm',this.key,Buffer.from(raw.iv,'base64')); decipher.setAuthTag(Buffer.from(raw.tag,'base64')); this.records=JSON.parse(Buffer.concat([decipher.update(Buffer.from(raw.data,'base64')),decipher.final()]).toString()); } catch(error) { if(error.code!=='ENOENT') throw error; }
  return this;
 }
 /** @param token Opaque browser token. @returns Hashed index. */
 hash(token) { return createHash('sha256').update(token).digest('hex'); }
 /** @param token Opaque browser token. @returns Live account session. */
 get(token) { if(typeof token!=='string') return; const value=this.records[this.hash(token)]; return value && value.expires>Date.now() ? value : undefined; }
 /** @param account Verified account. @returns Newly persisted opaque token. */
 async create(account) { const token=randomBytes(32).toString('base64url'); this.records[this.hash(token)]={...account,expires:Date.now()+this.days*86400000}; await this.save(); return token; }
 /** @param token Current browser token. */
 async remove(token) { if(token) delete this.records[this.hash(token)]; await this.save(); }
 /** @returns Durable encrypted write. */
 save() { const snapshot=JSON.stringify(this.records); const write=this.queue.then(async()=>{const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',this.key,iv);const data=Buffer.concat([cipher.update(snapshot),cipher.final()]);const file=join(this.directory,'sessions.json');await writeFile(file+'.tmp',JSON.stringify({iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')}),{mode:0o600});await rename(file+'.tmp',file);}); this.queue=write.catch(()=>{});return write; }
}
