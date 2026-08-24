-- O05 reservation: exact legacy URL redirects populated by migration tooling.
--
-- This migration is deliberately empty. Old application versions ignore the
-- table, while new versions treat an absent row as "no exact redirect".
CREATE TABLE redirect_map (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_path TEXT NOT NULL UNIQUE,
  target_path TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 301,
  entity_type TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (
    length(source_path) BETWEEN 3 AND 2048
    AND substr(source_path, 1, 1) = '/'
    AND substr(source_path, 1, 2) != '//'
    AND instr(source_path, '?') = 0
    AND instr(source_path, '#') = 0
    AND instr(source_path, char(92)) = 0
    AND instr(source_path, char(0)) = 0
    AND instr(source_path, char(9)) = 0
    AND instr(source_path, char(10)) = 0
    AND instr(source_path, char(13)) = 0
  ),
  CHECK (
    length(target_path) BETWEEN 1 AND 2048
    AND substr(target_path, 1, 1) = '/'
    AND substr(target_path, 1, 2) != '//'
    AND instr(target_path, '?') = 0
    AND instr(target_path, '#') = 0
    AND instr(target_path, char(92)) = 0
    AND instr(target_path, char(0)) = 0
    AND instr(target_path, char(9)) = 0
    AND instr(target_path, char(10)) = 0
    AND instr(target_path, char(13)) = 0
  ),
  CHECK (source_path != target_path),
  CHECK (
    target_path NOT LIKE '/products/%'
    AND target_path NOT LIKE '/collections/%'
    AND target_path NOT LIKE '/pages/%'
    AND target_path NOT LIKE '/blogs/%'
    AND target_path NOT LIKE '/policies/%'
  ),
  CHECK (status_code IN (301, 308)),
  CHECK (entity_type IS NULL OR length(trim(entity_type)) BETWEEN 1 AND 64),
  CHECK (created_at >= 0)
);

CREATE INDEX redirect_map_source_path_idx ON redirect_map(source_path);
