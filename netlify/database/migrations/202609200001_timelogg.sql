CREATE TABLE work_days (
  owner_id text NOT NULL,
  work_date date NOT NULL,
  target_hours numeric(5,2) NOT NULL DEFAULT 7.5 CHECK (target_hours > 0 AND target_hours <= 24),
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','complete')),
  revision integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, work_date)
);
CREATE TABLE time_entries (
  owner_id text NOT NULL,
  work_date date NOT NULL,
  id text NOT NULL,
  position integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('time','addition','manual')),
  description text NOT NULL,
  wbs text NOT NULL DEFAULT '',
  addition_type text NOT NULL DEFAULT '',
  start_time time,
  end_time time,
  hours numeric(8,4) NOT NULL CHECK (hours > 0 AND hours <= 24),
  PRIMARY KEY (owner_id, work_date, id),
  FOREIGN KEY (owner_id, work_date) REFERENCES work_days(owner_id, work_date) ON DELETE CASCADE,
  CHECK (kind <> 'time' OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time))
);
CREATE INDEX time_entries_owner_wbs ON time_entries(owner_id, wbs);
CREATE TABLE projects (
  owner_id text NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  PRIMARY KEY (owner_id, code)
);
