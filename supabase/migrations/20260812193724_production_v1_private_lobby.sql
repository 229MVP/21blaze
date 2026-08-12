-- production-v1 private lobby + server-held seed foundation.

insert into public.app_configuration(key,value)
values('production_v1_creation_enabled','false'::jsonb)
on conflict(key) do nothing;

create table if not exists public.production_v1_match_secrets (
  match_id uuid primary key references public.production_v1_matches(id) on delete cascade,
  seed text not null,
  created_at timestamptz not null default now()
);
alter table public.production_v1_match_secrets enable row level security;
revoke all on public.production_v1_match_secrets from public,anon,authenticated;

create or replace function public.create_production_v1_private_match(p_opponent_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,extensions as $$
declare v_user uuid:=auth.uid(); v_match public.production_v1_matches; v_seed text; v_enabled boolean;
begin
 if v_user is null then raise exception 'NOT_AUTHENTICATED' using errcode='42501'; end if;
 if p_opponent_id is null or p_opponent_id=v_user then raise exception 'INVALID_OPPONENT' using errcode='22023'; end if;
 if not exists(select 1 from auth.users where id=p_opponent_id) then raise exception 'OPPONENT_NOT_FOUND' using errcode='P0002'; end if;
 select coalesce((value#>>'{}')::boolean,false) into v_enabled from public.app_configuration where key='production_v1_creation_enabled';
 if not coalesce(v_enabled,false) then raise exception 'PRODUCTION_V1_DISABLED' using errcode='P0001'; end if;
 if exists(select 1 from public.production_v1_participants p join public.production_v1_matches m on m.id=p.match_id
   where p.user_id in(v_user,p_opponent_id) and m.status in('waiting','ready_check','countdown','active','resolving'))
   then raise exception 'ACTIVE_MATCH_LIMIT' using errcode='P0001'; end if;
 v_seed:='21blaze-production-v1:'||gen_random_uuid()::text||':'||encode(gen_random_bytes(24),'hex');
 insert into public.production_v1_matches(status,seed_commitment,authoritative_state)
 values('waiting',encode(digest(v_seed,'sha256'),'hex'),jsonb_build_object(
   'schemaVersion',1,'rulesVersion','production-v1','phase','waiting','players',jsonb_build_array(),
   'matchSeconds',90,'placementSeconds',8,'reconnectSeconds',20)) returning * into v_match;
 insert into public.production_v1_match_secrets(match_id,seed) values(v_match.id,v_seed);
 insert into public.production_v1_participants(match_id,user_id,seat) values(v_match.id,v_user,1),(v_match.id,p_opponent_id,2);
 return jsonb_build_object('matchId',v_match.id,'status',v_match.status,'rulesVersion',v_match.rules_version,
   'revision',v_match.revision,'seedCommitment',v_match.seed_commitment,'serverNow',now());
end $$;

create or replace function public.accept_production_v1_private_match(p_match_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_user uuid:=auth.uid(); v_match public.production_v1_matches; v_seat smallint;
begin
 if v_user is null then raise exception 'NOT_AUTHENTICATED' using errcode='42501'; end if;
 select seat into v_seat from public.production_v1_participants where match_id=p_match_id and user_id=v_user;
 if not found then raise exception 'NOT_PARTICIPANT' using errcode='42501'; end if;
 if v_seat<>2 then raise exception 'ONLY_OPPONENT_ACCEPTS' using errcode='42501'; end if;
 select * into v_match from public.production_v1_matches where id=p_match_id for update;
 if not found then raise exception 'MATCH_NOT_FOUND' using errcode='P0002'; end if;
 if v_match.status='ready_check' then return public.get_production_v1_snapshot(p_match_id); end if;
 if v_match.status<>'waiting' then raise exception 'INVALID_MATCH_STATE' using errcode='P0001'; end if;
 update public.production_v1_matches set status='ready_check',revision=revision+1,
   authoritative_state=authoritative_state||jsonb_build_object('phase','ready_check'),updated_at=now()
 where id=p_match_id returning * into v_match;
 return public.get_production_v1_snapshot(p_match_id);
end $$;

revoke all on function public.create_production_v1_private_match(uuid) from public,anon;
grant execute on function public.create_production_v1_private_match(uuid) to authenticated;
revoke all on function public.accept_production_v1_private_match(uuid) from public,anon;
grant execute on function public.accept_production_v1_private_match(uuid) to authenticated;
