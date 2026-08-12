-- production-v1 authoritative action/revision foundation.
-- Isolated from v1.5 Live PvP; no existing matchmaking behavior changes.

create table if not exists public.production_v1_matches (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'waiting' check (status in ('waiting','ready_check','countdown','active','resolving','completed','cancelled','forfeit','abandoned','invalidated')),
  rules_version text not null default 'production-v1' check (rules_version = 'production-v1'),
  revision bigint not null default 0 check (revision >= 0),
  seed_commitment text not null,
  authoritative_state jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.production_v1_participants (
  match_id uuid not null references public.production_v1_matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seat smallint not null check (seat in (1,2)),
  connected boolean not null default false,
  disconnect_deadline_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (match_id,user_id),
  unique (match_id,seat)
);

create table if not exists public.production_v1_actions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.production_v1_matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_action_id text not null check (char_length(client_action_id) between 8 and 128),
  expected_revision bigint not null check (expected_revision >= 0),
  intent jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','accepted','rejected')),
  result jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (match_id,user_id,client_action_id),
  unique (match_id,expected_revision)
);

create index if not exists production_v1_actions_pending_idx
  on public.production_v1_actions(status,created_at) where status in ('pending','processing');
create index if not exists production_v1_participants_user_idx
  on public.production_v1_participants(user_id,match_id);

alter table public.production_v1_matches enable row level security;
alter table public.production_v1_participants enable row level security;
alter table public.production_v1_actions enable row level security;

revoke all on public.production_v1_matches from public,anon,authenticated;
revoke all on public.production_v1_participants from public,anon,authenticated;
revoke all on public.production_v1_actions from public,anon,authenticated;

create or replace function public.get_production_v1_snapshot(p_match_id uuid)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public as $$
declare v_user uuid:=auth.uid(); v_match public.production_v1_matches;
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED' using errcode='42501'; end if;
  if not exists(select 1 from public.production_v1_participants where match_id=p_match_id and user_id=v_user)
    then raise exception 'NOT_PARTICIPANT' using errcode='42501'; end if;
  select * into v_match from public.production_v1_matches where id=p_match_id;
  if not found then raise exception 'MATCH_NOT_FOUND' using errcode='P0002'; end if;
  return jsonb_build_object('matchId',v_match.id,'status',v_match.status,'rulesVersion',v_match.rules_version,
    'revision',v_match.revision,'state',v_match.authoritative_state,'startedAt',v_match.started_at,
    'endsAt',v_match.ends_at,'serverNow',now());
end $$;

create or replace function public.enqueue_production_v1_intent(
  p_match_id uuid,p_client_action_id text,p_expected_revision bigint,p_intent jsonb
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public as $$
declare v_user uuid:=auth.uid(); v_match public.production_v1_matches; v_existing public.production_v1_actions; v_type text;
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED' using errcode='42501'; end if;
  if p_client_action_id is null or char_length(p_client_action_id) not between 8 and 128
    then raise exception 'INVALID_ACTION_ID' using errcode='22023'; end if;
  v_type:=p_intent->>'type';
  if v_type not in ('match.ready','card.place','power.activate','match.forfeit','match.rematch_vote')
    then raise exception 'INVALID_INTENT' using errcode='22023'; end if;
  if not exists(select 1 from public.production_v1_participants where match_id=p_match_id and user_id=v_user)
    then raise exception 'NOT_PARTICIPANT' using errcode='42501'; end if;

  select * into v_existing from public.production_v1_actions
    where match_id=p_match_id and user_id=v_user and client_action_id=p_client_action_id;
  if found then
    return jsonb_build_object('actionId',v_existing.id,'status',v_existing.status,'idempotent',true,
      'expectedRevision',v_existing.expected_revision,'result',v_existing.result);
  end if;

  select * into v_match from public.production_v1_matches where id=p_match_id for update;
  if not found then raise exception 'MATCH_NOT_FOUND' using errcode='P0002'; end if;
  if v_match.rules_version<>'production-v1' then raise exception 'RULES_VERSION_MISMATCH' using errcode='P0001'; end if;
  if v_match.status in ('completed','cancelled','forfeit','abandoned','invalidated')
    then raise exception 'MATCH_TERMINAL' using errcode='P0001'; end if;
  if p_expected_revision<>v_match.revision
    then raise exception 'STALE_REVISION' using errcode='40001',detail=format('expected %s current %s',p_expected_revision,v_match.revision); end if;

  insert into public.production_v1_actions(match_id,user_id,client_action_id,expected_revision,intent)
    values(p_match_id,v_user,p_client_action_id,p_expected_revision,p_intent) returning * into v_existing;
  return jsonb_build_object('actionId',v_existing.id,'status','pending','idempotent',false,
    'expectedRevision',v_existing.expected_revision,'serverNow',now());
exception when unique_violation then
  raise exception 'REVISION_ALREADY_QUEUED' using errcode='40001';
end $$;

create or replace function public.resolve_production_v1_action(
  p_action_id uuid,p_accept boolean,p_next_state jsonb,p_result jsonb default '{}'::jsonb
) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_action public.production_v1_actions; v_match public.production_v1_matches;
begin
  select * into v_action from public.production_v1_actions where id=p_action_id for update;
  if not found then raise exception 'ACTION_NOT_FOUND' using errcode='P0002'; end if;
  if v_action.status in ('accepted','rejected') then return coalesce(v_action.result,'{}'::jsonb); end if;
  select * into v_match from public.production_v1_matches where id=v_action.match_id for update;
  if v_match.revision<>v_action.expected_revision then raise exception 'STALE_REVISION' using errcode='40001'; end if;
  if p_accept then
    update public.production_v1_matches set authoritative_state=p_next_state,revision=revision+1,updated_at=now()
      where id=v_match.id;
  end if;
  update public.production_v1_actions set status=case when p_accept then 'accepted' else 'rejected' end,
    result=p_result||jsonb_build_object('revision',case when p_accept then v_match.revision+1 else v_match.revision end),processed_at=now()
    where id=p_action_id returning * into v_action;
  return v_action.result;
end $$;

revoke all on function public.get_production_v1_snapshot(uuid) from public,anon;
grant execute on function public.get_production_v1_snapshot(uuid) to authenticated;
revoke all on function public.enqueue_production_v1_intent(uuid,text,bigint,jsonb) from public,anon;
grant execute on function public.enqueue_production_v1_intent(uuid,text,bigint,jsonb) to authenticated;
revoke all on function public.resolve_production_v1_action(uuid,boolean,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.resolve_production_v1_action(uuid,boolean,jsonb,jsonb) to service_role;
