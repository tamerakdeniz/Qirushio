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

-- Normalize the candidate once. Similar sentence templates with different
-- answers are different facts, not duplicates (e.g. capitals of two countries).
create or replace function public.is_known_question(p_prompt text, p_answer text, p_knowledge_key text)
returns boolean language plpgsql volatile
set search_path = public, extensions
set pg_trgm.similarity_threshold = '0.55'
as $$
declare
  prompt_key text := public.normalize_question_text(p_prompt);
  answer_key text := public.normalize_question_text(p_answer);
  fact_key text := nullif(public.normalize_question_text(p_knowledge_key), '');
begin
  return exists (
    select 1 from public.question_history h
    where h.normalized_prompt = prompt_key
      or (h.knowledge_key is not null and h.knowledge_key = fact_key)
      or (h.normalized_prompt % prompt_key and h.normalized_answer = answer_key)
  );
end;
$$;

revoke execute on function public.set_generation_deadline(), public.recover_expired_generation(uuid)
  from public, anon, authenticated;
grant execute on function public.recover_expired_generation(uuid) to service_role;
