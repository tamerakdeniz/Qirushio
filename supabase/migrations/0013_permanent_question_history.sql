-- Question memory intentionally has no room/player FK and no expiry.
create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create or replace function public.normalize_question_text(value text)
returns text language sql stable set search_path = public, extensions
as $$
  select trim(regexp_replace(lower(unaccent(translate(coalesce(value, ''), 'İı', 'Ii'))), '[^[:alnum:]]+', ' ', 'g'));
$$;

create table if not exists public.question_history (
  id bigint generated always as identity primary key,
  prompt text not null,
  normalized_prompt text not null unique,
  normalized_answer text not null,
  knowledge_key text,
  created_at timestamptz not null default now()
);
create unique index if not exists question_history_knowledge_key_index
  on public.question_history (knowledge_key) where knowledge_key is not null;
-- Respect the schema of an already-installed pg_trgm extension.
do $$
declare extension_schema text;
begin
  select n.nspname into extension_schema from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_trgm';
  execute format('create index if not exists question_history_prompt_similarity_index on public.question_history using gin (normalized_prompt %I.gin_trgm_ops)', extension_schema);
end;
$$;
create index if not exists question_history_recent_index
  on public.question_history (id desc);

alter table public.question_history enable row level security;
revoke all on public.question_history from public, anon, authenticated;
grant select, insert on public.question_history to service_role;
grant usage, select on sequence public.question_history_id_seq to service_role;

alter table public.questions add column if not exists knowledge_key text;

-- Preserve all surviving questions, including those older than 24 hours.
insert into public.question_history (prompt, normalized_prompt, normalized_answer, created_at)
select distinct on (public.normalize_question_text(q.prompt))
  q.prompt, public.normalize_question_text(q.prompt),
  public.normalize_question_text(q.options ->> q.correct_option::integer), q.created_at
from public.questions q
order by public.normalize_question_text(q.prompt), q.created_at
on conflict (normalized_prompt) do nothing;

create or replace function public.is_known_question(p_prompt text, p_answer text, p_knowledge_key text)
returns boolean language sql volatile
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.question_history h
    where h.normalized_prompt = public.normalize_question_text(p_prompt)
      or (h.knowledge_key is not null and h.knowledge_key = nullif(public.normalize_question_text(p_knowledge_key), ''))
      or (similarity(h.normalized_prompt, public.normalize_question_text(p_prompt)) >= 0.55
        and (similarity(h.normalized_prompt, public.normalize_question_text(p_prompt)) >= 0.82
          or h.normalized_answer = public.normalize_question_text(p_answer)))
  );
$$;

-- Cheap indexed checks against the entire archive; the model only needs a small
-- recent sample in its prompt. Ordinals are zero-based for the TypeScript caller.
create or replace function public.filter_new_questions(p_questions jsonb)
returns setof integer language plpgsql
set search_path = ''
as $$
declare candidate jsonb; ordinal bigint;
begin
  if p_questions is null or jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) > 30 then
    raise exception 'invalid_question_batch';
  end if;
  for candidate, ordinal in select value, ordinality from jsonb_array_elements(p_questions) with ordinality loop
    if not public.is_known_question(candidate->>'prompt', candidate->'options'->>((candidate->>'correctOption')::integer), candidate->>'knowledgeKey') then
      return next (ordinal - 1)::integer;
    end if;
  end loop;
end;
$$;

-- Serialize only the short check/insert transaction, never AI network calls.
-- Every insert path (including an older app instance) updates permanent memory.
create or replace function public.remember_question()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(724193, 1);
  if public.is_known_question(new.prompt, new.options->>new.correct_option::integer, new.knowledge_key) then
    raise exception 'duplicate_question' using errcode = 'P0001';
  end if;
  insert into public.question_history (prompt, normalized_prompt, normalized_answer, knowledge_key)
  values (new.prompt, public.normalize_question_text(new.prompt),
    public.normalize_question_text(new.options->>new.correct_option::integer),
    nullif(public.normalize_question_text(new.knowledge_key), ''));
  return new;
end;
$$;
drop trigger if exists questions_remember on public.questions;
create trigger questions_remember before insert on public.questions
for each row execute function public.remember_question();

-- Publishing questions and starting the countdown either both succeed or both
-- roll back, including all history writes made by the trigger.
create or replace function public.publish_generated_round(p_room_id uuid, p_round_number integer, p_questions jsonb)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare room_row public.rooms%rowtype;
begin
  select * into room_row from public.rooms where id = p_room_id for update;
  if room_row.id is null or room_row.phase <> 'generating' or room_row.round_number <> p_round_number then
    raise exception 'round_no_longer_generating';
  end if;
  if p_questions is null or jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) <> room_row.question_count then
    raise exception 'incomplete_question_batch';
  end if;
  insert into public.questions (room_id, round_number, position, category, prompt, options, correct_option, explanation, knowledge_key)
  select p_room_id, p_round_number, (ordinality - 1)::integer, value->>'category', value->>'prompt',
    value->'options', (value->>'correctOption')::smallint, value->>'explanation', value->>'knowledgeKey'
  from jsonb_array_elements(p_questions) with ordinality;
  update public.rooms set phase = 'countdown', current_question_index = -1,
    phase_ends_at = now() + interval '10 seconds', generation_error = null
  where id = p_room_id;
  return true;
end;
$$;

revoke execute on function public.normalize_question_text(text), public.is_known_question(text, text, text),
  public.filter_new_questions(jsonb), public.remember_question(), public.publish_generated_round(uuid, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.normalize_question_text(text), public.is_known_question(text, text, text),
  public.filter_new_questions(jsonb), public.publish_generated_round(uuid, integer, jsonb) to service_role;
