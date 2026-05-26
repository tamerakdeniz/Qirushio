alter table public.rooms
  drop constraint if exists rooms_question_time_seconds_check;

alter table public.rooms
  add constraint rooms_question_time_seconds_check
  check (question_time_seconds between 3 and 30);

alter table public.rooms
  add column if not exists speedrun_mode boolean not null default false;

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
        update public.rooms
        set phase = 'finished', phase_ends_at = null
        where id = p_room_id;
        return query select true, 'finished'::public.room_phase;
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

  return query select false, room_row.phase;
end;
$$;
