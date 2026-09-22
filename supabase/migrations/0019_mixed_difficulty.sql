alter table public.rooms drop constraint if exists rooms_difficulty_check;
alter table public.rooms add constraint rooms_difficulty_check
  check (difficulty in ('easy', 'medium', 'hard', 'mixed'));
