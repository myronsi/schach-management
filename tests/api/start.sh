#!/bin/sh
set -e
rm -rf /var/www && mkdir -p /var/www/api /var/www/docs/vereinsdokumente /var/www/photos/sommerfest
cp -r /src/. /var/www/api/
cp /test/test.env.auth /var/www/api/.env.auth
cp /test/test.env /var/www/api/.env
echo "secret" > /var/www/outside.txt
echo "pdf" > /var/www/docs/vereinsdokumente/satzung.pdf
cd /var/www && exec php -d error_reporting=-1 -d log_errors=1 -d display_errors=0 -d error_log=/dev/stderr -S 0.0.0.0:8099 -t /var/www
