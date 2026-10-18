#!/bin/sh
set -e
cd "$(dirname "$0")"
TEST_DIR="$(pwd)"
SERVER_DIR="$(cd ../../server && pwd)"
case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) TEST_DIR="$(cygpath -w "$TEST_DIR")"; SERVER_DIR="$(cygpath -w "$SERVER_DIR")"; export MSYS_NO_PATHCONV=1;; esac
PHP_VERSION="${1:-8.0}"
IMG="schach-api-test:php$PHP_VERSION"

docker build -q --build-arg PHP_VERSION="$PHP_VERSION" -t "$IMG" . >/dev/null
docker rm -f smdb smapi >/dev/null 2>&1 || true
docker network create smnet >/dev/null 2>&1 || true
trap 'docker rm -f smdb smapi >/dev/null 2>&1 || true' EXIT

docker run -d --name smdb --network smnet -e MARIADB_ROOT_PASSWORD=testpw -e MARIADB_DATABASE=club \
  -v "$TEST_DIR/schema.sql:/docker-entrypoint-initdb.d/schema.sql:ro" mariadb:10.11 >/dev/null
i=0; until docker exec smdb mariadb -uroot -ptestpw club -e "select 1 from news limit 1" >/dev/null 2>&1; do
  i=$((i+1)); [ $i -gt 60 ] && { echo "database did not start"; exit 1; }; sleep 2; done
docker run --rm --network smnet -v "$TEST_DIR:/test:ro" "$IMG" php /test/seed.php
docker run -d --name smapi --network smnet -p 8099:8099 -v "$SERVER_DIR:/src:ro" -v "$TEST_DIR:/test:ro" "$IMG" sh /test/start.sh >/dev/null
sleep 2

node test.mjs
echo "--- PHP warnings/errors:"
docker logs smapi 2>&1 | grep -E "PHP (Warning|Notice|Deprecated|Fatal|Parse)|Uncaught" || echo "none"
