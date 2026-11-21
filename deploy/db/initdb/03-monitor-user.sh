#!/bin/bash
# Sourced once by the MySQL entrypoint on the first start of an empty database.
# Creates the read-only user used by the monitor Lambda (hirfati-db-monitor).
docker_process_sql --database=mysql <<EOSQL
CREATE USER IF NOT EXISTS '${MONITOR_USER}'@'%' IDENTIFIED BY '${MONITOR_PASSWORD}';
GRANT SELECT ON ${MYSQL_DATABASE}.* TO '${MONITOR_USER}'@'%';
FLUSH PRIVILEGES;
EOSQL
