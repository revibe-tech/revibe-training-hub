-- Per-person activity: active time on each page, material and slide, plus key
-- actions (opened, searched, asked the assistant, completed, rated). Run once
-- in Supabase → SQL Editor.
--
-- Same lockdown as the assistant tables: only the Next.js server writes and
-- reads these, with the service-role key. Browsers send events to
-- /api/activity, which takes the person from their verified Firebase token.

create table if not exists public.activity_events (
  id bigint generated always as identity primary key,
  uid text not null,                  -- Firebase uid
  type text not null,                 -- time | open | search | ask | complete | feedback
  path text,                          -- route, e.g. /viewer
  material_id text,
  page integer,                       -- slide, for time spent on it
  seconds integer not null default 0, -- active seconds (type 'time')
  detail jsonb,                       -- small extras, e.g. { "q": "refund", "results": 3 }
  session_id text,                    -- one visit in one browser tab
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists activity_events_uid_time_idx on public.activity_events (uid, occurred_at desc);
create index if not exists activity_events_time_idx on public.activity_events (occurred_at desc);

alter table public.activity_events enable row level security;

-- One person's activity since p_since, for the trainer's People page.
-- Days are counted in p_tz (the trainer's time zone).
create or replace function public.user_activity_summary(p_uid text, p_since timestamptz, p_tz text default 'UTC')
returns jsonb
language sql
stable
set search_path = public
as $$
  with ev as (
    select * from public.activity_events where uid = p_uid and occurred_at >= p_since
  ),
  timed as (
    select * from ev where type = 'time'
  )
  select jsonb_build_object(
    'total_seconds', coalesce((select sum(seconds) from timed), 0),
    'active_days', (select count(distinct (occurred_at at time zone p_tz)::date) from ev),
    'sessions', (select count(distinct session_id) from ev),
    'last_at', (select max(occurred_at) from ev),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'seconds', seconds) order by day)
      from (
        select (occurred_at at time zone p_tz)::date as day, sum(seconds)::int as seconds
        from timed group by 1
      ) d
    ), '[]'::jsonb),
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object('path', path, 'seconds', seconds) order by seconds desc)
      from (
        select coalesce(path, '') as path, sum(seconds)::int as seconds
        from timed group by 1
      ) p
    ), '[]'::jsonb),
    'materials', coalesce((
      select jsonb_agg(jsonb_build_object(
        'material_id', m.material_id,
        'seconds', m.seconds,
        'opens', m.opens,
        'last_at', m.last_at,
        'slides', coalesce((
          select jsonb_agg(jsonb_build_object('page', s.page, 'seconds', s.seconds) order by s.page)
          from (
            select page, sum(seconds)::int as seconds
            from timed
            where timed.material_id = m.material_id and page is not null
            group by page
          ) s
        ), '[]'::jsonb)
      ) order by m.seconds desc, m.last_at desc)
      from (
        select material_id,
               coalesce(sum(seconds) filter (where type = 'time'), 0)::int as seconds,
               count(*) filter (where type = 'open')::int as opens,
               max(occurred_at) as last_at
        from ev
        where material_id is not null
        group by material_id
      ) m
    ), '[]'::jsonb),
    'counts', coalesce((
      select jsonb_object_agg(type, n)
      from (select type, count(*)::int as n from ev where type <> 'time' group by type) c
    ), '{}'::jsonb),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object('type', type, 'at', occurred_at, 'material_id', material_id, 'detail', detail) order by occurred_at desc)
      from (select * from ev where type <> 'time' order by occurred_at desc limit 40) r
    ), '[]'::jsonb)
  );
$$;

-- Everyone's totals since p_since, for the People list.
create or replace function public.activity_overview(p_since timestamptz)
returns table (uid text, seconds integer, actions integer, last_at timestamptz)
language sql
stable
set search_path = public
as $$
  select e.uid,
         coalesce(sum(e.seconds) filter (where e.type = 'time'), 0)::int,
         (count(*) filter (where e.type <> 'time'))::int,
         max(e.occurred_at)
  from public.activity_events e
  where e.occurred_at >= p_since
  group by e.uid;
$$;

revoke all on function public.user_activity_summary(text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.activity_overview(timestamptz) from public, anon, authenticated;
grant execute on function public.user_activity_summary(text, timestamptz, text) to service_role;
grant execute on function public.activity_overview(timestamptz) to service_role;

-- Optional retention, e.g. keep six months:
-- delete from public.activity_events where occurred_at < now() - interval '180 days';
