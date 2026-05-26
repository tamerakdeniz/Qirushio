alter table public.rooms
  drop constraint if exists rooms_question_time_seconds_check;

alter table public.rooms
  add constraint rooms_question_time_seconds_check
  check (question_time_seconds between 5 and 30);
