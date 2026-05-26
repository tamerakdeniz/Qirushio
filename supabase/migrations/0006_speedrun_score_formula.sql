-- Speedrun: award points for sub-second remaining time; allow score upgrade on sync retry

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
