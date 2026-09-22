-- A process killed by the hosting timeout cannot execute the route's catch.
-- Give the generating phase its own DB deadline, independent of room activity.
create or replace function public.set_generation_deadline()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.phase = 'generating' and
    (old.phase is distinct from new.phase or old.round_number is distinct from new.round_number) then
    new.phase_ends_at := clock_timestamp() + interval '120 seconds';
  end if;
  return new;
end;
$$;
drop trigger if exists rooms_generation_deadline on public.rooms;
create trigger rooms_generation_deadline before update of phase, round_number on public.rooms
for each row execute function public.set_generation_deadline();

update public.rooms set phase_ends_at = clock_timestamp() + interval '120 seconds'
where phase = 'generating' and phase_ends_at is null;

create or replace function public.recover_expired_generation(p_room_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare recovered integer;
begin
  update public.rooms set phase = 'lobby', phase_ends_at = null,
    generation_error = 'Soru hazırlama süresi doldu. Lütfen tekrar deneyin.'
  where id = p_room_id and phase = 'generating' and phase_ends_at <= clock_timestamp();
  get diagnostics recovered = row_count;
  return recovered > 0;
end;
$$;

-- Filter by answer through a B-tree index before calculating similarity.
-- No extension GUC changes are needed by the migration or service_role.
create index if not exists question_history_answer_index
  on public.question_history (normalized_answer);

-- Normalize the candidate once. Similar sentence templates with different
-- answers are different facts, not duplicates (e.g. capitals of two countries).
create or replace function public.is_known_question(p_prompt text, p_answer text, p_knowledge_key text)
returns boolean language plpgsql volatile
set search_path = public, extensions
as $$
declare
  prompt_key text := public.normalize_question_text(p_prompt);
  answer_key text := public.normalize_question_text(p_answer);
  fact_key text := nullif(public.normalize_question_text(p_knowledge_key), '');
begin
  return exists (
    select 1 from public.question_history h where h.normalized_prompt = prompt_key
  ) or (fact_key is not null and exists (
    select 1 from public.question_history h where h.knowledge_key = fact_key
  )) or exists (
    select 1 from public.question_history h
    where h.normalized_answer = answer_key
      and similarity(h.normalized_prompt, prompt_key) >= 0.55
  );
end;
$$;

revoke execute on function public.set_generation_deadline(), public.recover_expired_generation(uuid)
  from public, anon, authenticated;
grant execute on function public.recover_expired_generation(uuid) to service_role;
