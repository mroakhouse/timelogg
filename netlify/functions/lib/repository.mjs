export async function readData(client, owner) {
  const {rows:days}=await client.query('SELECT work_date::text AS date, target_hours, note, status, revision FROM work_days WHERE owner_id=$1 ORDER BY work_date',[owner]);
  const {rows:entries}=await client.query(`SELECT work_date::text AS date, id, kind, description AS desc, wbs AS "order", addition_type AS type, to_char(start_time,'HH24:MI') AS start, to_char(end_time,'HH24:MI') AS end, hours FROM time_entries WHERE owner_id=$1 ORDER BY work_date, position`,[owner]);
  const result=Object.fromEntries(days.map(d=>[d.date,{target:Number(d.target_hours),note:d.note,status:d.status,revision:d.revision,entries:[]}]));
  for(const e of entries){const {date,...entry}=e;result[date].entries.push({...entry,hours:Number(e.hours),start:e.start||'',end:e.end||''});}
  const {rows:projects}=await client.query('SELECT code, name FROM projects WHERE owner_id=$1 ORDER BY code',[owner]);
  return {days:result,projects};
}
export async function writeDay(client,owner,date,day) {
  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[owner+date]);
    const {rows}=await client.query('SELECT revision FROM work_days WHERE owner_id=$1 AND work_date=$2 FOR UPDATE',[owner,date]);
    if((rows[0]?.revision||0)!==day.revision)throw Object.assign(new Error('conflict'),{status:409});
    const revision=day.revision+1;
    await client.query('INSERT INTO work_days(owner_id,work_date,target_hours,note,status,revision) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(owner_id,work_date) DO UPDATE SET target_hours=$3,note=$4,status=$5,revision=$6,updated_at=now()',[owner,date,day.target,day.note,day.status,revision]);
    await client.query('DELETE FROM time_entries WHERE owner_id=$1 AND work_date=$2',[owner,date]);
    for(const [i,e] of day.entries.entries())await client.query('INSERT INTO time_entries(owner_id,work_date,id,position,kind,description,wbs,addition_type,start_time,end_time,hours) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[owner,date,e.id,i,e.kind,e.desc,e.order,e.type,e.start||null,e.end||null,e.hours]);
    await client.query('COMMIT'); return revision;
  }catch(e){await client.query('ROLLBACK');throw e;}
}
