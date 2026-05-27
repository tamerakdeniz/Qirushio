-- All rooms: scoring-phase answer grace and end-of-round scoring before results

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
  existing_score integer;
  score_delta integer;
  scoring_grace boolean := false;
begin
  select *
  into room_row
  from public.rooms
  where id = p_room_id
  for update;

  scoring_grace := room_row.phase = 'scoring';

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
    when correct then
      greatest(
        10,
        ceiling(greatest(remaining_ms, 1)::numeric / 1000)::integer * 10
      )
    else 0
  end;

  select a.score
  into existing_score
  from public.answers a
  where a.question_id = p_question_id
    and a.player_id = p_player_id;

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
  on conflict (question_id, player_id) do update
  set
    selected_option = excluded.selected_option,
    answered_at = excluded.answered_at,
    time_remaining_ms = excluded.time_remaining_ms,
    score = excluded.score,
    is_correct = excluded.is_correct
  where public.answers.score < excluded.score
  returning score into inserted_score;

  if inserted_score is null then
    return query
    select false, coalesce(existing_score, 0);
    return;
  end if;

  score_delta := inserted_score - coalesce(existing_score, 0);
  if score_delta > 0 then
    update public.players
    set score = score + score_delta
    where id = p_player_id;
  end if;

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
  v_scoring_ms integer;
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
        v_scoring_ms := case
          when room_row.question_pause_ms > 0 then room_row.question_pause_ms
          else 1500
        end;
        update public.rooms
        set phase = 'scoring',
            phase_ends_at = v_now + (v_scoring_ms * interval '1 millisecond')
        where id = p_room_id;
        return query select true, 'scoring'::public.room_phase;
      elsif room_row.question_pause_ms > 0 then
        update public.rooms
        set phase = 'transition',
            phase_ends_at = v_now + (room_row.question_pause_ms * interval '1 millisecond')
        where id = p_room_id;
        return query select true, 'transition'::public.room_phase;
      else
        update public.rooms
        set phase = 'question',
            current_question_index = current_question_index + 1,
            phase_ends_at = v_now + make_interval(secs => room_row.question_time_seconds)
        where id = p_room_id;
        return query select true, 'question'::public.room_phase;
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
