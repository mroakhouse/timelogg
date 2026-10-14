import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { validateDay, dateKey } from '../../src/model.js';
import { createBlobRepository } from './lib/blob-repository.mjs';
// To switch back to Netlify Database: import { createSqlRepository } from './lib/sql-repository.mjs' and use it as the default repository.
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export function createHandler({authenticate=getUser, repository=createBlobRepository()}={}) {
  return async req=>{
    try {
      const user=await authenticate();
      if(!user?.id)return json({error:'unauthorized'},401);
      // Prevent an old tab from submitting one account's draft after an account switch.
      if(req.headers.get('X-Timelogg-Account') && req.headers.get('X-Timelogg-Account')!==user.id)return json({error:'unauthorized'},401);
      if(!['GET','PUT','POST'].includes(req.method))return json({error:'method'},405);
      let body;
      if(req.method!=='GET'){
        verifyRequestOrigin(req);
        const raw=await req.text();
        if(raw.length>250000)return json({error:'tooLarge'},413);
        try{body=JSON.parse(raw);}catch{return json({error:'invalidDay'},400);}
      }
      if(req.method==='PUT'){
        if(!body || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)||dateKey(new Date(body.date+'T12:00:00'))!==body.date)return json({error:'invalidDay'},400);
        try{body.day=validateDay(body.day);}catch(e){return json({error:e.message},400);}
      }
      if(req.method==='POST' && (!body || typeof body.code!=='string'||!body.code.trim()||body.code.length>100||typeof body.name!=='string'||!body.name.trim()||body.name.length>200))return json({error:'invalidText'},400);
      if(req.method==='GET')return json(await repository.readData(user.id));
      if(req.method==='PUT')return json({revision:await repository.writeDay(user.id,body.date,body.day)});
      await repository.saveProject(user.id,{code:body.code.trim(),name:body.name.trim()});
      return json({ok:true});
    }catch(e){if(e.status===409)return json({error:'conflict'},409);if(e.status===403)return json({error:'forbidden'},403);console.error('Timelogg data request failed',e);return json({error:'serverError'},503);}
  };
}
export default createHandler();
export const config={path:'/api/data'};
