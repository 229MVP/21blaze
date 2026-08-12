alter table public.production_v1_match_secrets add column if not exists server_state jsonb not null default '{}'::jsonb;

create or replace function public.resolve_production_v1_action_v2(
  p_action_id uuid,
  p_accept boolean,
  p_public_state jsonb,
  p_server_state jsonb,
  p_status text,
  p_started_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_result jsonb default '{}'::jsonb
) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_action public.production_v1_actions; v_match public.production_v1_matches;
begin
  select * into v_action from public.production_v1_actions where id=p_action_id for update;
  if not found then raise exception 'ACTION_NOT_FOUND' using errcode='P0002'; end if;
  if v_action.status in ('accepted','rejected') then return coalesce(v_action.result,'{}'::jsonb); end if;
  select * into v_match from public.production_v1_matches where id=v_action.match_id for update;
  if not found then raise exception 'MATCH_NOT_FOUND' using errcode='P0002'; end if;
  if v_match.revision<>v_action.expected_revision then raise exception 'STALE_REVISION' using errcode='40001'; end if;
  if p_accept then
    update public.production_v1_match_secrets set server_state=p_server_state where match_id=v_match.id;
    update public.production_v1_matches set authoritative_state=p_public_state,status=p_status,
      started_at=coalesce(p_started_at,started_at),ends_at=coalesce(p_ends_at,ends_at),
      revision=revision+1,updated_at=now() where id=v_match.id;
  end if;
  update public.production_v1_actions set status=case when p_accept then 'accepted' else 'rejected' end,
    result=p_result||jsonb_build_object('revision',case when p_accept then v_match.revision+1 else v_match.revision end),
    processed_at=now() where id=p_action_id returning * into v_action;
  return v_action.result;
end $$;

revoke all on function public.resolve_production_v1_action_v2(uuid,boolean,jsonb,jsonb,text,timestamptz,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.resolve_production_v1_action_v2(uuid,boolean,jsonb,jsonb,text,timestamptz,timestamptz,jsonb) to service_role;