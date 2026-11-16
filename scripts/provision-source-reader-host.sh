#!/usr/bin/env bash
set -euo pipefail

database=${1:?Database name is required}
username=${2:?Username is required}
client_host=${3:?Client host is required}

if [[ ! "$database" =~ ^[A-Za-z0-9_]+$ ]] \
  || [[ ! "$username" =~ ^[A-Za-z0-9_]+$ ]] \
  || [[ ! "$client_host" =~ ^[A-Fa-f0-9:.]+$ ]]; then
  echo "Invalid database, username, or client host" >&2
  exit 2
fi

read -r encoded_password
password_hex=$(printf '%s' "$encoded_password" | base64 -d | od -An -tx1 | tr -d ' \n')
if [[ -z "$password_hex" ]]; then
  echo "Password input is empty" >&2
  exit 2
fi

mysql -e "
  CREATE USER IF NOT EXISTS '${username}'@'${client_host}'
    IDENTIFIED BY 'Temporary_Reader_A1!' REQUIRE SSL;
  SET @reader_password = CONVERT(0x${password_hex} USING utf8mb4);
  SET @alter_reader = CONCAT(
    'ALTER USER ''${username}''@''${client_host}'' IDENTIFIED BY ',
    QUOTE(@reader_password),
    ' REQUIRE SSL'
  );
  PREPARE alter_reader_statement FROM @alter_reader;
  EXECUTE alter_reader_statement;
  DEALLOCATE PREPARE alter_reader_statement;
  GRANT SELECT ON \`${database}\`.* TO '${username}'@'${client_host}';
  FLUSH PRIVILEGES;
"

mysql -NBe "SHOW GRANTS FOR '${username}'@'${client_host}';"
