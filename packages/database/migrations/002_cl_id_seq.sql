-- Migration 002: CL ID sequence table
-- Provides atomic, race-free CL-YYYY-XXXX generation.

create table if not exists cl_id_seq (
  year integer primary key,
  seq  integer not null default 0
);
