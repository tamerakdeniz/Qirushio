alter table public.rooms
  drop constraint if exists rooms_max_players_check;

alter table public.rooms
  add constraint rooms_max_players_check
  check (max_players >= 2);

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
