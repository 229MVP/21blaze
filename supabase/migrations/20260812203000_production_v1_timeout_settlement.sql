create or replace function public.settle_production_v1_timeout(
  p_match_id uuid,p_expected_revision bigint,p_public_state jsonb,p_server_state jsonb
) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_match public.production_v1_matches;
begin
  select * into v_match from public.production_v1_matches where id=p_match_id for update;
  if not found then raise exception 'MATCH_NOT_FOUND' using errcode='P0002'; end if;
  if v_match.status='completed' then return jsonb_build_object('revision',v_match.revision,'idempotent',true); end if;
  if v_match.status<>'active' then raise exception 'INVALID_MATCH_STATE' using errcode='P0001'; end if;
  if v_match.ends_at is null or v_match.ends_at>now() then raise exception 'MATCH_NOT_EXPIRED' using errcode='P0001'; end if;
  if v_match.revision<>p_expected_revision then raise exception 'STALE_REVISION' using errcode='40001'; end if;
  update public.production_v1_match_secrets set server_state=p_server_state where match_id=p_match_id;
  update public.production_v1_matches set status='completed',authoritative_state=p_public_state,
    revision=revision+1,updated_at=now() where id=p_match_id;
  return jsonb_build_object('revision',v_match.revision+1,'idempotent',false);
end $$;
revoke all on function public.settle_production_v1_timeout(uuid,bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.settle_production_v1_timeout(uuid,bigint,jsonb,jsonb) to service_role;