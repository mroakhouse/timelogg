export const today = () => dateKey(new Date());
export function dateKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function shift(day, n) { const d=new Date(`${day}T12:00:00`); d.setDate(d.getDate()+n); return dateKey(d); }
export function week(day) { const n=new Date(`${day}T12:00:00`).getDay(); const monday=shift(day,-((n+6)%7)); return Array.from({length:7},(_,i)=>shift(monday,i)); }
export const hours = (n,lang='nb') => Number(n).toLocaleString(lang==='nb'?'nb-NO':'en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
export const emptyDay = () => ({target:7.5,note:'',status:'draft',revision:0,entries:[]});
export function duration(start,end) { const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3)); return (minutes(end)-minutes(start))/60; }
export function total(day, additions=false) { return (day?.entries||[]).filter(e=>additions || e.kind!=='addition').reduce((n,e)=>n+e.hours,0); }
export function validateDay(value) {
  if(!value || typeof value!=='object' || !Array.isArray(value.entries) || value.entries.length>200) throw new Error('invalidDay');
  const target=Number(value.target);
  if(!Number.isFinite(target)||target<=0||target>24) throw new Error('invalidTarget');
  if(!['draft','complete'].includes(value.status)) throw new Error('invalidDay');
  const text=(v,max)=>{if(typeof v!=='string'||v.length>max)throw new Error('invalidText');return v.trim();};
  const entries=value.entries.map(e=>{
    if(!['time','addition','manual'].includes(e.kind))throw new Error('invalidDay');
    const entry={id:text(e.id,100),kind:e.kind,desc:text(e.desc,500),order:text(e.order||'',100),type:text(e.type||'',100),start:e.start||'',end:e.end||'',hours:Number(e.hours)};
    if(!entry.id||!entry.desc)throw new Error('invalidEntry');
    if(entry.kind==='time'){
      const time=/^([01]\d|2[0-3]):[0-5]\d$/;
      if(!time.test(entry.start)||!time.test(entry.end)||duration(entry.start,entry.end)<=0)throw new Error('invalidTime');
      entry.hours=duration(entry.start,entry.end);
    } else {entry.start='';entry.end='';}
    if(!Number.isFinite(entry.hours)||entry.hours<=0||entry.hours>24)throw new Error('invalidEntry');
    return entry;
  });
  if(new Set(entries.map(e=>e.id)).size!==entries.length)throw new Error('invalidDay');
  const timed=entries.filter(e=>e.kind==='time').sort((a,b)=>a.start.localeCompare(b.start));
  if(timed.some((e,i)=>i>0&&e.start<timed[i-1].end))throw new Error('overlap');
  return {target,note:text(value.note||'',2000),status:value.status,revision:Number.isInteger(value.revision)&&value.revision>=0?value.revision:0,entries};
}
export function importLegacy(payload) {
  const source=payload.timelogg||payload.days||payload;
  return Object.fromEntries(Object.entries(source).map(([date,day])=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||dateKey(new Date(`${date}T12:00:00`))!==date)throw new Error('invalidDay');
    return [date,validateDay({...emptyDay(),...day,status:'draft',revision:0,entries:day.entries.map(e=>({...e,id:crypto.randomUUID(),kind:e.kind||'manual'}))})];
  }));
}
