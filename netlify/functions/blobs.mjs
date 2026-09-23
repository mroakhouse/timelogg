import { getStore } from '@netlify/blobs';
import { getUser } from '@netlify/identity';
// Read-only migration source; the original data is preserved.
export default async function(req){
  const user=await getUser();
  if(!user?.id)return new Response(null,{status:401});
  if(req.method!=='GET')return new Response(null,{status:405});
  try{
    const data=await getStore({name:'timelogg',consistency:'strong'}).get(`user_${user.id}`,{type:'json'});
    return Response.json(data||{timelogg:{},lookup:[]},{headers:{'Cache-Control':'no-store'}});
  }catch{return Response.json({error:'serverError'},{status:503});}
}
export const config={path:'/api/blobs'};
