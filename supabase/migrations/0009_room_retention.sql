-- Keep rooms (and questions) for dedupe until cron deletes after 1 day of inactivity.

alter table public.rooms
  add column if not exists last_active_at timestamptz not null default now();

update public.rooms
set last_active_at = coalesce(updated_at, created_at, now());

alter table public.rooms
  alter column expires_at set default (now() + interval '1 day');

update public.rooms
set expires_at = greatest(expires_at, now() + interval '1 day')
where expires_at < now() + interval '1 day';

create or replace function public.keep_room_alive()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.last_active_at := now();
  new.expires_at := now() + interval '1 day';
  return new;
end;
$$;

create or replace function public.touch_room_from_players()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_room_id uuid;
begin
  target_room_id := coalesce(new.room_id, old.room_id);
  update public.rooms
  set last_active_at = now(),
      expires_at = now() + interval '1 day',
      updated_at = now()
  where id = target_room_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists players_touch_room on public.players;

create trigger players_touch_room
after insert or update or delete on public.players
for each row execute procedure public.touch_room_from_players();

create index if not exists rooms_listing_index
  on public.rooms (phase, is_public, last_active_at desc);

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
