alter table public.rooms
  drop constraint if exists rooms_category_check;

alter table public.rooms
  add constraint rooms_category_check
  check (category in ('general', 'science', 'sports', 'arts', 'history', 'random'));
