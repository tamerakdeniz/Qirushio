-- Medicine is an opt-in classic category; medical year replaces generic difficulty.
alter table public.rooms add column if not exists medical_year smallint not null default 1;
alter table public.rooms drop constraint if exists rooms_medical_year_check;
alter table public.rooms add constraint rooms_medical_year_check check (medical_year between 1 and 6);
alter table public.rooms drop constraint if exists rooms_category_check;
alter table public.rooms add constraint rooms_category_check check (category in (
  'general', 'science', 'sports', 'arts', 'history', 'scuba', 'medicine', 'random',
  'ft_general', 'ft_norm', 'ft_internal', 'ft_norm_internal_mix', 'ft_git_github', 'ft_mixed'
));
