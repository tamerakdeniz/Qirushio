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
      'scuba',
      'random',
      'ft_general',
      'ft_norm',
      'ft_internal',
      'ft_norm_internal_mix',
      'ft_git_github',
      'ft_mixed'
    )
  );
