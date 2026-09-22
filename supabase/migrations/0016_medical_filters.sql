-- Explicit year selections replace the cumulative ceiling in the new medical UI.
-- Null preserves the previous scope of existing rooms.
alter table public.rooms
  add column if not exists medical_years smallint[],
  add column if not exists medical_subject text not null default 'mixed';
alter table public.rooms add constraint rooms_medical_years_check check (
  medical_years is null or (
    cardinality(medical_years) between 1 and 6
    and medical_years <@ array[1,2,3,4,5,6]::smallint[]
    and array_position(medical_years, null) is null
  )
);
alter table public.rooms add constraint rooms_medical_subject_check check (
  medical_subject in ('mixed', 'anatomy', 'physiology', 'histology', 'biochemistry',
    'microbiology', 'pathology', 'pharmacology', 'internal', 'pediatrics', 'surgery',
    'obgyn', 'neurology', 'psychiatry', 'public_health')
);
