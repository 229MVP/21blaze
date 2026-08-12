import { createClient } from 'npm:@supabase/supabase-js@2.109.0';
import { createState, place, type State } from '../_shared/productionV1Engine.ts';

type Intent={type:string;laneIndex?:number};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
const publicPlayer=(state:State)=>({lanes:state.lanes,bonusScore:state.bonusScore,energy:state.energy,streak:state.streak,multiplier:state.multiplier,currentCard:state.deck[state.cursor]});

Deno.serve(async(req:Request)=>{
  if(req.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
  const auth=req.headers.get('authorization'); if(!auth)return json({error:'NOT_AUTHENTICATED'},401);
  const url=Deno.env.get('SUPABASE_URL')!; const anon=Deno.env.get('SUPABASE_ANON_KEY')!; const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const caller=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:{user},error:userError}=await caller.auth.getUser(); if(userError||!user)return json({error:'NOT_AUTHENTICATED'},401);
  const body=await req.json().catch(()=>null) as {actionId?:string}|null; if(!body?.actionId)return json({error:'ACTION_ID_REQUIRED'},400);
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:action,error:actionError}=await admin.from('production_v1_actions').select('id,match_id,user_id,expected_revision,intent,status').eq('id',body.actionId).maybeSingle();
  if(actionError||!action)return json({error:'ACTION_NOT_FOUND'},404); if(action.user_id!==user.id)return json({error:'NOT_ACTION_OWNER'},403);
  if(['accepted','rejected'].includes(action.status))return json({status:action.status,idempotent:true});
  const [{data:match},{data:secretRow},{data:participants}]=await Promise.all([
    admin.from('production_v1_matches').select('id,status,revision,authoritative_state').eq('id',action.match_id).single(),
    admin.from('production_v1_match_secrets').select('seed,server_state').eq('match_id',action.match_id).single(),
    admin.from('production_v1_participants').select('user_id,seat').eq('match_id',action.match_id).order('seat'),
  ]);
  if(!match||!secretRow||!participants)return json({error:'MATCH_STATE_MISSING'},409);
  if(Number(match.revision)!==Number(action.expected_revision))return json({error:'STALE_REVISION'},409);
  const intent=action.intent as Intent; let server=(secretRow.server_state??{}) as Record<string,unknown>; let status=match.status; let startsAt:string|null=null; let endsAt:string|null=null;
  try{
    if(intent.type==='match.ready'){
      if(!['ready_check','countdown'].includes(status))throw new Error('INVALID_MATCH_STATE');
      const ready=new Set<string>((server.readyUserIds as string[]|undefined)??[]); ready.add(user.id); server={...server,readyUserIds:[...ready]};
      if(ready.size===2){const players:Record<string,State>={};for(const p of participants)players[p.user_id]=createState(secretRow.seed);server={...server,players};status='active';startsAt=new Date().toISOString();endsAt=new Date(Date.now()+90000).toISOString();}
    }else if(intent.type==='card.place'){
      if(status!=='active')throw new Error('INVALID_MATCH_STATE'); const laneIndex=intent.laneIndex; if(typeof laneIndex!=='number'||!Number.isInteger(laneIndex)||laneIndex<0||laneIndex>3)throw new Error('INVALID_LANE');
      const players={...server.players as Record<string,State>}; if(!players[user.id])throw new Error('PLAYER_STATE_MISSING'); players[user.id]=place(players[user.id],laneIndex as 0|1|2|3,secretRow.seed);server={...server,players};
    }else if(intent.type==='match.forfeit'){status='forfeit';server={...server,forfeitUserId:user.id};}
    else throw new Error('INTENT_NOT_IMPLEMENTED');
  }catch(error){const code=error instanceof Error?error.message:'INVALID_ACTION';await admin.rpc('resolve_production_v1_action_v2',{p_action_id:action.id,p_accept:false,p_public_state:match.authoritative_state,p_server_state:server,p_status:status,p_started_at:null,p_ends_at:null,p_result:{error:code}});return json({error:code},409);}
  const players=server.players as Record<string,State>|undefined; const publicState={schemaVersion:1,rulesVersion:'production-v1',phase:status,readyUserIds:server.readyUserIds??[],players:players?Object.fromEntries(Object.entries(players).map(([id,state])=>[id,publicPlayer(state)])): {}};
  const {data:result,error:resolveError}=await admin.rpc('resolve_production_v1_action_v2',{p_action_id:action.id,p_accept:true,p_public_state:publicState,p_server_state:server,p_status:status,p_started_at:startsAt,p_ends_at:endsAt,p_result:{ok:true}});
  if(resolveError)return json({error:resolveError.message},409); return json(result);
});