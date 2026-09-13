-- Runs only on first initialisation of the hub-db volume.
-- Creates the second database used by eventando-manager (the first, hub-community-db, comes from MYSQL_DATABASE).
CREATE DATABASE IF NOT EXISTS `event-launch` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
