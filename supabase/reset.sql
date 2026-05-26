-- Qirushio: Full Supabase reset + clean install.
-- Supabase Dashboard → SQL Editor'a tek seferde yapıştırıp çalıştırın.
-- Bu script tüm proje şemasını siler ve sıfırdan kurar. DİKKAT: VERİLER GİDER.

begin;

-- 1) Drop everything (works even when schema is empty or half-removed) -----
-- Do NOT drop triggers by name on public.rooms: if the table is missing,
-- PostgreSQL raises 42P01. CASCADE on table drop removes triggers automatically.

drop table if exists public.answers cascade;
drop table if exists public.questions cascade;
drop table if exists public.player_sessions cascade;
drop table if exists public.players cascade;
drop table if exists public.rooms cascade;

drop function if exists public.return_to_lobby(uuid, uuid, text) cascade;
drop function if exists public.advance_game(uuid) cascade;
drop function if exists public.submit_answer(uuid, uuid, text, uuid, smallint) cascade;
drop function if exists public.submit_answer(uuid, uuid, text, uuid, smallint, integer) cascade;
drop function if exists public.begin_round(uuid, uuid, text) cascade;
drop function if exists public.cleanup_expired_rooms() cascade;
drop function if exists public.keep_room_alive() cascade;

drop type if exists public.room_phase cascade;

-- 2) Clean install (combined migrations 0001 + 0002) -------------------------

create extension if not exists pgcrypto;

create type public.room_phase as enum (
  'lobby',
  'generating',
  'countdown',
  'question',
  'transition',
  'scoring',
  'finished'
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  host_player_id uuid,
  phase public.room_phase not null default 'lobby',
  language text not null default 'tr' check (language in ('tr', 'en')),
  category text not null default 'general'
    check (category in ('general', 'science', 'sports', 'arts', 'history', 'random')),
  difficulty text not null default 'medium'
    check (difficulty in ('easy', 'medium', 'hard')),
  scope text not null default 'global' check (scope in ('global', 'local')),
  question_count integer not null default 10 check (question_count between 5 and 20),
  question_time_seconds integer not null default 20
    check (question_time_seconds between 3 and 30),
  speedrun_mode boolean not null default false,
  is_public boolean not null default true,
  max_players integer not null default 10 check (max_players between 2 and 20),
  round_number integer not null default 0,
  current_question_index integer not null default -1,
  phase_ends_at timestamptz,
  generation_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '4 hours')
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 24),
  normalized_nickname text generated always as (lower(trim(nickname))) stored,
  is_host boolean not null default false,
  is_ready boolean not null default false,
  score integer not null default 0 check (score >= 0),
  joined_at timestamptz not null default now(),
  unique (room_id, normalized_nickname)
);

alter table public.rooms
  add constraint rooms_host_player_fk
  foreign key (host_player_id) references public.players(id) on delete set null;

create table public.player_sessions (
  player_id uuid primary key references public.players(id) on delete cascade,
  token_hash text not null,
  created_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_number integer not null,
  position integer not null check (position >= 0),
  category text not null,
  prompt text not null,
  options jsonb not null check (
    jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 5
  ),
  correct_option smallint not null check (correct_option between 0 and 4),
  explanation text not null,
  created_at timestamptz not null default now(),
  unique (room_id, round_number, position)
);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_number integer not null,
  question_id uuid not null references public.questions(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  selected_option smallint not null check (selected_option between 0 and 4),
  answered_at timestamptz not null default now(),
  time_remaining_ms integer not null check (time_remaining_ms >= 0),
  score integer not null check (score >= 0),
  is_correct boolean not null,
  unique (question_id, player_id)
);

create index rooms_open_index on public.rooms (phase, is_public, created_at desc);
create index players_room_index on public.players (room_id, joined_at);
create index questions_round_index on public.questions (room_id, round_number, position);
create index answers_question_index on public.answers (question_id);
create index rooms_expiry_index on public.rooms (expires_at);

create or replace function public.keep_room_alive()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.expires_at := now() + interval '4 hours';
  return new;
end;
$$;

create trigger rooms_keep_alive
before update on public.rooms
for each row execute procedure public.keep_room_alive();

create or replace function public.cleanup_expired_rooms()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count bigint;
begin
  delete from public.rooms where expires_at < now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

create or replace function public.begin_round(
  p_room_id uuid,
  p_host_id uuid,
  p_token_hash text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  room_row public.rooms%rowtype;
begin
  select *
  into room_row
  from public.rooms
  where id = p_room_id
  for update;

  if room_row.id is null then
    raise exception 'room_not_found';
  end if;

  if not exists (
    select 1
    from public.players p
    join public.player_sessions s on s.player_id = p.id
    where p.id = p_host_id
      and p.room_id = p_room_id
      and p.is_host
      and s.token_hash = p_token_hash
  ) then
    raise exception 'host_required';
  end if;

  if room_row.phase not in ('lobby', 'finished') then
    raise exception 'round_already_active';
  end if;

  if exists (
    select 1 from public.players
    where room_id = p_room_id and not is_ready
  ) then
    raise exception 'players_not_ready';
  end if;

  delete from public.questions where room_id = p_room_id;
  update public.players set score = 0 where room_id = p_room_id;

  update public.rooms
  set phase = 'generating',
      round_number = round_number + 1,
      current_question_index = -1,
      phase_ends_at = null,
      generation_error = null
  where id = p_room_id
  returning round_number into room_row.round_number;

  return room_row.round_number;
end;
$$;

create or replace function public.submit_answer(
  p_room_id uuid,
  p_player_id uuid,
  p_token_hash text,
  p_question_id uuid,
  p_selected_option smallint,
  p_time_remaining_ms integer default null
)
returns table (accepted boolean, earned_score integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  room_row public.rooms%rowtype;
  question_row public.questions%rowtype;
  v_now timestamptz := clock_timestamp();
  remaining_ms integer;
  calculated_score integer;
  correct boolean;
  inserted_score integer;
  scoring_grace boolean := false;
begin
  select *
  into room_row
  from public.rooms
  where id = p_room_id
  for update;

  scoring_grace := room_row.speedrun_mode and room_row.phase = 'scoring';

  if scoring_grace then
    null;
  elsif room_row.phase <> 'question'
     or room_row.phase_ends_at is null
     or room_row.phase_ends_at <= v_now then
    raise exception 'question_closed';
  end if;

  if not exists (
    select 1
    from public.players p
    join public.player_sessions s on s.player_id = p.id
    where p.id = p_player_id
      and p.room_id = p_room_id
      and s.token_hash = p_token_hash
  ) then
    raise exception 'invalid_player';
  end if;

  if scoring_grace then
    select *
    into question_row
    from public.questions
    where id = p_question_id
      and room_id = p_room_id
      and round_number = room_row.round_number;

    if question_row.id is null then
      raise exception 'invalid_question';
    end if;

    remaining_ms := least(
      room_row.question_time_seconds * 1000,
      greatest(
        0,
        coalesce(p_time_remaining_ms, room_row.question_time_seconds * 1000)
      )
    );
  else
    select *
    into question_row
    from public.questions
    where id = p_question_id
      and room_id = p_room_id
      and round_number = room_row.round_number
      and position = room_row.current_question_index;

    if question_row.id is null then
      raise exception 'invalid_question';
    end if;

    remaining_ms := least(
      room_row.question_time_seconds * 1000,
      greatest(
        0,
        floor(extract(epoch from (room_row.phase_ends_at - v_now)) * 1000)::integer
      )
    );
  end if;
  correct := question_row.correct_option = p_selected_option;
  calculated_score := case
    when correct then floor(remaining_ms::numeric / 1000)::integer * 10
    else 0
  end;

  insert into public.answers (
    room_id,
    round_number,
    question_id,
    player_id,
    selected_option,
    answered_at,
    time_remaining_ms,
    score,
    is_correct
  ) values (
    p_room_id,
    room_row.round_number,
    p_question_id,
    p_player_id,
    p_selected_option,
    v_now,
    remaining_ms,
    calculated_score,
    correct
  )
  on conflict (question_id, player_id) do nothing
  returning score into inserted_score;

  if inserted_score is null then
    return query
    select false, a.score from public.answers a
    where a.question_id = p_question_id and a.player_id = p_player_id;
    return;
  end if;

  update public.players
  set score = score + inserted_score
  where id = p_player_id;

  return query select true, inserted_score;
end;
$$;

create or replace function public.advance_game(p_room_id uuid)
returns table (changed boolean, next_phase public.room_phase)
language plpgsql
security definer
set search_path = ''
as $$
declare
  room_row public.rooms%rowtype;
  v_now timestamptz := clock_timestamp();
  v_question_id uuid;
  player_count integer;
  answer_count integer;
begin
  select *
  into room_row
  from public.rooms
  where id = p_room_id
  for update;

  if room_row.id is null then
    raise exception 'room_not_found';
  end if;

  if room_row.phase = 'countdown'
     and room_row.phase_ends_at <= v_now then
    update public.rooms
    set phase = 'question',
        current_question_index = 0,
        phase_ends_at = v_now + make_interval(secs => room_row.question_time_seconds)
    where id = p_room_id;
    return query select true, 'question'::public.room_phase;
    return;
  end if;

  if room_row.phase = 'question' then
    select q.id into v_question_id
    from public.questions q
    where q.room_id = p_room_id
      and q.round_number = room_row.round_number
      and q.position = room_row.current_question_index;

    select count(*)::integer into player_count
    from public.players where room_id = p_room_id;

    select count(*)::integer into answer_count
    from public.answers
    where room_id = p_room_id
      and round_number = room_row.round_number
      and public.answers.question_id = v_question_id;

    if room_row.phase_ends_at <= v_now or answer_count >= player_count then
      if room_row.current_question_index + 1 >= room_row.question_count then
        if room_row.speedrun_mode then
          update public.rooms
          set phase = 'scoring',
              phase_ends_at = v_now + interval '3 seconds'
          where id = p_room_id;
          return query select true, 'scoring'::public.room_phase;
        else
          update public.rooms
          set phase = 'finished', phase_ends_at = null
          where id = p_room_id;
          return query select true, 'finished'::public.room_phase;
        end if;
      elsif room_row.speedrun_mode then
        update public.rooms
        set phase = 'question',
            current_question_index = current_question_index + 1,
            phase_ends_at = v_now + make_interval(secs => room_row.question_time_seconds)
        where id = p_room_id;
        return query select true, 'question'::public.room_phase;
      else
        update public.rooms
        set phase = 'transition',
            phase_ends_at = v_now + interval '3 seconds'
        where id = p_room_id;
        return query select true, 'transition'::public.room_phase;
      end if;
      return;
    end if;
  end if;

  if room_row.phase = 'transition'
     and room_row.phase_ends_at <= v_now then
    update public.rooms
    set phase = 'question',
        current_question_index = current_question_index + 1,
        phase_ends_at = v_now + make_interval(secs => room_row.question_time_seconds)
    where id = p_room_id;
    return query select true, 'question'::public.room_phase;
    return;
  end if;

  if room_row.phase = 'scoring'
     and room_row.phase_ends_at <= v_now then
    update public.rooms
    set phase = 'finished', phase_ends_at = null
    where id = p_room_id;
    return query select true, 'finished'::public.room_phase;
    return;
  end if;

  return query select false, room_row.phase;
end;
$$;

create or replace function public.return_to_lobby(
  p_room_id uuid,
  p_host_id uuid,
  p_token_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.players p
    join public.player_sessions s on s.player_id = p.id
    where p.id = p_host_id
      and p.room_id = p_room_id
      and p.is_host
      and s.token_hash = p_token_hash
  ) then
    raise exception 'host_required';
  end if;

  delete from public.questions where room_id = p_room_id;
  update public.players
  set score = 0, is_ready = is_host
  where room_id = p_room_id;
  update public.rooms
  set phase = 'lobby',
      current_question_index = -1,
      phase_ends_at = null,
      generation_error = null
  where id = p_room_id;
  return true;
end;
$$;

alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.player_sessions enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;

revoke all on public.rooms, public.players, public.player_sessions, public.questions, public.answers
  from anon, authenticated;
revoke execute on function public.cleanup_expired_rooms() from public, anon, authenticated;
revoke execute on function public.begin_round(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.submit_answer(uuid, uuid, text, uuid, smallint, integer)
  from public, anon, authenticated;
revoke execute on function public.advance_game(uuid) from public, anon, authenticated;
revoke execute on function public.return_to_lobby(uuid, uuid, text)
  from public, anon, authenticated;

commit;

-- 3) Sanity check (opsiyonel) ------------------------------------------------
-- select table_name from information_schema.tables
--   where table_schema = 'public' order by table_name;
