-- Run after migrations in an isolated development database. All fixtures roll back.
begin;
create function pg_temp.assert_true(condition boolean, message text)
returns void language plpgsql as $$
begin
  if condition is distinct from true then raise exception 'Assertion failed: %', message; end if;
end;
$$;

insert into public.rooms (id, code, phase, round_number, question_count)
values ('00000000-0000-0000-0000-000000000001', 'TESTAA', 'generating', 1, 5),
       ('00000000-0000-0000-0000-000000000002', 'TESTAB', 'generating', 1, 5);

insert into public.questions (room_id, round_number, position, category, prompt, options, correct_option, explanation, knowledge_key)
values ('00000000-0000-0000-0000-000000000001', 0, 0, 'General', 'What is the capital of Turkey?',
  '["Ankara","Istanbul","Izmir","Bursa","Antalya"]', 0, 'Ankara is the capital.', 'turkey|capital|ankara');
update public.question_history set created_at = now() - interval '90 days' where knowledge_key = 'turkey capital ankara';

select pg_temp.assert_true(public.normalize_question_text('İSTANBUL’ın  başkenti?') = 'istanbul in baskenti', 'Turkish normalization');
select pg_temp.assert_true(public.is_known_question('WHAT is the capital of Turkey!!!', 'Ankara', null), 'exact normalization');
select pg_temp.assert_true(public.is_known_question('What is Turkey''s capital?', 'Ankara', null), 'near duplicate with same answer');
select pg_temp.assert_true(public.is_known_question('Türkiye’nin başkenti hangi şehir?', 'Ankara', 'turkey|capital|ankara'), 'cross-language fact identity');
select pg_temp.assert_true(not public.is_known_question('Who composed the opera The Magic Flute?', 'Mozart', 'magic flute|composer|mozart'), 'unrelated new fact');

-- Cleanup cascades live questions, but must never erase permanent memory.
delete from public.rooms where id = '00000000-0000-0000-0000-000000000001';
select pg_temp.assert_true(public.is_known_question('What is the capital of Turkey?', 'Ankara', null), 'memory survives room deletion and 24 hours');
select pg_temp.assert_true((select count(*) = 0 from public.filter_new_questions('[{"prompt":"What is the capital of Turkey?","options":["Ankara"],"correctOption":0}]')), 'full-history filtering');

-- Same-batch collisions must roll back BOTH questions and history.
do $$
begin
  begin
    perform public.publish_generated_round('00000000-0000-0000-0000-000000000002', 1,
      '[{"category":"Art","prompt":"Who composed The Magic Flute?","options":["Mozart","B","C","D","E"],"correctOption":0,"explanation":"Mozart composed it.","knowledgeKey":"magic flute|composer|mozart"},
        {"category":"Art","prompt":"Name the composer of this opera: The Magic Flute.","options":["Mozart","B","C","D","E"],"correctOption":0,"explanation":"Mozart composed it.","knowledgeKey":"magic flute|composer|mozart"},
        {"category":"Science","prompt":"Which element uses the symbol Au?","options":["Gold","B","C","D","E"],"correctOption":0,"explanation":"Au denotes gold.","knowledgeKey":"au|element|gold"},
        {"category":"History","prompt":"Where did ancient Olympic Games originate?","options":["Greece","B","C","D","E"],"correctOption":0,"explanation":"Ancient Greece.","knowledgeKey":"olympic games|origin|greece"},
        {"category":"Geography","prompt":"Which ocean surrounds the Maldives?","options":["Indian","B","C","D","E"],"correctOption":0,"explanation":"The Indian Ocean.","knowledgeKey":"maldives|ocean|indian"}]');
    raise exception 'Duplicate batch unexpectedly published';
  exception when raise_exception then
    if sqlerrm <> 'duplicate_question' then raise; end if;
  end;
end;
$$;
select pg_temp.assert_true((select count(*) = 0 from public.questions where room_id = '00000000-0000-0000-0000-000000000002'), 'no partial live batch');
select pg_temp.assert_true(not public.is_known_question('Who composed The Magic Flute?', 'Mozart', 'magic flute|composer|mozart'), 'history rolled back');
select pg_temp.assert_true((select phase = 'generating' from public.rooms where code = 'TESTAB'), 'failed batch cannot start countdown');

-- Exact repeats from another room are rejected even without a fact key.
do $$
begin
  begin
    insert into public.questions (room_id, round_number, position, category, prompt, options, correct_option, explanation)
    values ('00000000-0000-0000-0000-000000000002', 1, 0, 'General', 'What is the capital of Turkey?', '["Ankara","B","C","D","E"]', 0, 'Ankara is the capital.');
    raise exception 'Duplicate insert unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'duplicate_question' then raise; end if;
  end;
end;
$$;

-- Successful publication stores all five questions and starts the countdown.
select public.publish_generated_round('00000000-0000-0000-0000-000000000002', 1,
  '[{"category":"Art","prompt":"Who composed The Magic Flute?","options":["Mozart","B","C","D","E"],"correctOption":0,"explanation":"Mozart composed it.","knowledgeKey":"magic flute|composer|mozart"},
    {"category":"Literature","prompt":"Who wrote the novel Frankenstein?","options":["Mary Shelley","B","C","D","E"],"correctOption":0,"explanation":"Mary Shelley wrote it.","knowledgeKey":"frankenstein|author|mary shelley"},
    {"category":"Science","prompt":"Which element uses the symbol Au?","options":["Gold","B","C","D","E"],"correctOption":0,"explanation":"Au denotes gold.","knowledgeKey":"au|element|gold"},
    {"category":"History","prompt":"Where did ancient Olympic Games originate?","options":["Greece","B","C","D","E"],"correctOption":0,"explanation":"Ancient Greece.","knowledgeKey":"olympic games|origin|greece"},
    {"category":"Geography","prompt":"Which ocean surrounds the Maldives?","options":["Indian","B","C","D","E"],"correctOption":0,"explanation":"The Indian Ocean.","knowledgeKey":"maldives|ocean|indian"}]');
select pg_temp.assert_true((select count(*) = 5 from public.questions where room_id = '00000000-0000-0000-0000-000000000002'), 'complete live batch');
select pg_temp.assert_true((select phase = 'countdown' and phase_ends_at > now() from public.rooms where code = 'TESTAB'), 'countdown after complete publication');

-- A stale request cannot publish into an already started round.
do $$
begin
  begin
    perform public.publish_generated_round('00000000-0000-0000-0000-000000000002', 1, '[]');
    raise exception 'Stale publication unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'round_no_longer_generating' then raise; end if;
  end;
end;
$$;

-- Generation timeout survives process death and ignores unrelated room activity.
update public.rooms set phase = 'generating', round_number = 2 where code = 'TESTAB';
select pg_temp.assert_true((select phase_ends_at > clock_timestamp() + interval '110 seconds' from public.rooms where code = 'TESTAB'), 'generation deadline installed');
select pg_temp.assert_true(not public.recover_expired_generation('00000000-0000-0000-0000-000000000002'), 'active generation preserved');
update public.rooms set phase_ends_at = clock_timestamp() - interval '1 second' where code = 'TESTAB';
select pg_temp.assert_true(public.recover_expired_generation('00000000-0000-0000-0000-000000000002'), 'stuck generation recovered');
select pg_temp.assert_true((select phase = 'lobby' and generation_error is not null from public.rooms where code = 'TESTAB'), 'recovered room playable');
update public.rooms set phase = 'generating', round_number = 3 where code = 'TESTAB';
select pg_temp.assert_true(not public.recover_expired_generation('00000000-0000-0000-0000-000000000002'), 'new round cannot be cancelled by stale recovery');

insert into public.questions (room_id, round_number, position, category, prompt, options, correct_option, explanation, knowledge_key)
values ('00000000-0000-0000-0000-000000000002', 3, 0, 'General', 'What is the capital city of France?', '["Paris","B","C","D","E"]', 0, 'The capital is Paris.', 'france|capital|paris');
select pg_temp.assert_true(not public.is_known_question('What is the capital city of Italy?', 'Rome', 'italy|capital|rome'), 'similar template with different answer is allowed');
select pg_temp.assert_true(public.is_known_question('What is the capital city of France?', 'Lyon', 'unreliable key'), 'identical prompt blocked even with a changed answer');

-- Function creation/execution must not require permission to set an extension GUC.
select pg_temp.assert_true(not exists (
  select 1 from pg_proc p, unnest(p.proconfig) c
  where p.oid = 'public.is_known_question(text,text,text)'::regprocedure
    and c like 'pg_trgm.similarity_threshold=%'
), 'duplicate checks do not change extension settings');
select pg_temp.assert_true(to_regclass('public.question_history_answer_index') is not null, 'answer similarity lookup is indexed');

-- Medicine category/year settings persist without changing other categories.
update public.rooms set category = 'medicine', medical_year = 6 where code = 'TESTAB';
select pg_temp.assert_true((select category = 'medicine' and medical_year = 6 from public.rooms where code = 'TESTAB'), 'medical year persists');
do $$
begin
  begin
    update public.rooms set medical_year = 7 where code = 'TESTAB';
    raise exception 'Invalid medical year accepted';
  exception when check_violation then null;
  end;
end;
$$;

-- RLS and RPC permissions must not expose question memory to browsers.
select pg_temp.assert_true(not has_table_privilege('anon', 'public.question_history', 'SELECT'), 'anonymous history access denied');
select pg_temp.assert_true(not has_function_privilege('authenticated', 'public.publish_generated_round(uuid,integer,jsonb)', 'EXECUTE'), 'browser publication denied');
select pg_temp.assert_true(has_function_privilege('service_role', 'public.filter_new_questions(jsonb)', 'EXECUTE'), 'server history access allowed');
rollback;
