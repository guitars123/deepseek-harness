import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

/** Reject product-branch changes outside its dedicated directory against the fetched master. */
const cwd=fileURLToPath(new URL('../../../',import.meta.url));
const base=process.env.XC_DSH_BASE_REF || 'origin/master';
const git=args=>execFileSync('git',args,{cwd,encoding:'utf8'}).trim();
const paths=['--','.',':(exclude)custom/xc-product'];
const changed=git(['diff','--name-only',base,...paths]);
const untracked=git(['ls-files','--others','--exclude-standard',...paths]);
if(changed || untracked)throw new Error('Native DSH files differ from '+base+':\n'+[changed,untracked].filter(Boolean).join('\n'));
console.log('Native DSH matches '+base+' ('+git(['rev-parse',base])+')');
