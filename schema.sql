-- phpMyAdmin: najprej ustvari bazo (npr. bowling_liga), jo izberi, nato Import tega fajla.
-- Aplikacija tabelo ob prvem zagonu tudi sama ustvari, če še ne obstaja.

CREATE TABLE IF NOT EXISTS seasons (
  id VARCHAR(64) NOT NULL,
  label VARCHAR(255) NOT NULL,
  archived_at DATETIME NULL DEFAULT NULL,
  data MEDIUMTEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_seasons_archived_updated (archived_at, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
