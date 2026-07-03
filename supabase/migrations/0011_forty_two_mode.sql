alter table public.rooms
  add column if not exists mode text not null default 'classic';

alter table public.rooms
  drop constraint if exists rooms_mode_check;

alter table public.rooms
  add constraint rooms_mode_check
  check (mode in ('classic', 'fortyTwo'));

alter table public.rooms
  drop constraint if exists rooms_category_check;

alter table public.rooms
  add constraint rooms_category_check
  check (
    category in (
      'general',
      'science',
      'sports',
      'arts',
      'history',
      'random',
      'ft_general',
      'ft_norm',
      'ft_internal',
      'ft_norm_internal_mix',
      'ft_git_github',
      'ft_mixed'
    )
  );

update public.rooms
set mode = 'fortyTwo'
where category in (
  'ft_general',
  'ft_norm',
  'ft_internal',
  'ft_norm_internal_mix',
  'ft_git_github',
  'ft_mixed'
);

create index if not exists rooms_mode_listing_index
  on public.rooms (mode, phase, is_public, last_active_at desc);
