import { getStore } from '@netlify/blobs';
// One JSON blob per user per month: users/<owner>/months/YYYY-MM = {days:{date:day}}, plus users/<owner>/projects.
// Writes use ETag compare-and-swap, so concurrent saves to the same month never overwrite each other.
const conflict=()=>Object.assign(new Error('conflict'),{status:409});
const prefix=owner=>{if(!/^[\w-]+$/.test(owner))throw new Error('invalidOwner');return `users/${owner}/`;};
async function update(store,key,change){
  for(let attempt=0;attempt<10;attempt++){
    if(attempt)await new Promise(r=>setTimeout(r,Math.random()*50*attempt));
    const current=await store.getWithMetadata(key,{type:'json'});
    const {modified}=await store.setJSON(key,change(current?.data),current?{onlyIfMatch:current.etag}:{onlyIfNew:true});
    if(modified)return;
  }
  throw conflict();
}
export function createBlobRepository(store=()=>getStore({name:'timelogg-data',consistency:'strong'})) {
  return {
    async readData(owner) {
      const s=store(),base=prefix(owner);
      const {blobs}=await s.list({prefix:base+'months/'});
      const months=await Promise.all(blobs.map(b=>s.get(b.key,{type:'json'})));
      const days=Object.fromEntries(months.flatMap(m=>Object.entries(m?.days||{})).sort(([a],[b])=>a.localeCompare(b)));
      const projects=((await s.get(base+'projects',{type:'json'}))||[]).sort((a,b)=>a.code.localeCompare(b.code));
      return {days,projects};
    },
    async writeDay(owner,date,day) {
      const revision=day.revision+1;
      await update(store(),`${prefix(owner)}months/${date.slice(0,7)}`,month=>{
        const days={...month?.days};
        if((days[date]?.revision||0)!==day.revision)throw conflict();
        days[date]={...day,revision};
        return {days};
      });
      return revision;
    },
    // previousCode renames a project; its entries are moved by the client through regular day saves.
    async saveProject(owner,{code,name,previousCode}) {
      await update(store(),prefix(owner)+'projects',list=>[...(list||[]).filter(p=>p.code!==code&&p.code!==previousCode),{code,name}]);
    },
  };
}
