#!/usr/bin/env bash
# Builds the site the suite runs against, in a DDEV project: Mautic (GPL-3.0), the open-source marketing automation
# platform, from its release package, installed with its own command-line installer (bin/console mautic:install) on
# the project's database, with the accounts of the test users and the test content:
#
#   - https://<project>.ddev.site/        the site (the release in mautic/, the docroot), served by Apache with the
#                                          release's own rules (.htaccess); the administration at /s/;
#   - https://<project>.ddev.site:8026    the project's mail catcher (Mailpit), which the site sends its mail to.
#
# The site's scheduled tasks (its cron: the segments, then the campaigns) run every 15 seconds in the web container,
# as a daemon of the project (.ddev/config.mautic.yaml): a segment of filters fills, a campaign acts.
#
# The site is set up for testing with site/mautic-site.php, run by PHP in the web container with the site's own code:
# the same script the Webship Workspace's plugin runs. It sends the site's mail to the mail catcher, sends no
# statistics to an outside service, makes the roles Marketer and Sales and the accounts, and the test content.
#
# Settings (environment variables, all optional):
#   PROJECT_NAME          the DDEV project name                          (default mauticsteps)
#   SITE_DIR              the project folder                             (default a new temporary folder)
#   MAUTIC_VERSION        the release                                    (default 7.2.2)
#   PHP_VERSION           the PHP of the web container                   (default 8.3)
#   ACCOUNT_PASSWORD      the password of the accounts below            (default dD.123123ddd)
#   BUILD_ADMIN           the administrator the installer makes, for the build only   (default admin)
#   BUILD_ADMIN_PASSWORD  its password                                   (default ACCOUNT_PASSWORD)
#   ACCOUNTS_ONLY         1: build nothing, give the accounts of the site in SITE_DIR back their names, address,
#                         password and role
#   TIDY_ONLY             1: build nothing, remove what a run that was stopped half way left on the site in SITE_DIR
#                         (everything named "Webship test …", tags and addresses "webship-test-…", and the site's
#                         record of failed logins, which locks an account out for 30 minutes after three)
#
# The accounts are configuration: this script makes them and cucumber.js names them; the features never create
# or delete one. Each logs in with its user name.
#   administrator  administrator@example.com  the role Administrator: everything
#   marketer       marketer@example.com       the role Marketer: the marketing tools, not the users or the settings
#   sales          sales@example.com          the role Sales: the contacts it owns and their notes
#
# No hosted service, no account anywhere, nothing that is not open source.
set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-mauticsteps}"
MAUTIC_VERSION="${MAUTIC_VERSION:-7.2.2}"
PHP_VERSION="${PHP_VERSION:-8.3}"
ACCOUNT_PASSWORD="${ACCOUNT_PASSWORD:-dD.123123ddd}"
BUILD_ADMIN="${BUILD_ADMIN:-admin}"
BUILD_ADMIN_PASSWORD="${BUILD_ADMIN_PASSWORD:-$ACCOUNT_PASSWORD}"
SITE_DIR="${SITE_DIR:-$(mktemp -d)}"
SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../site" && pwd)/mautic-site.php"
ROOT=/var/www/html
SITE="${ROOT}/mautic"
HOST="${PROJECT_NAME}.ddev.site"
SITE_URL="https://${HOST}"
PACKAGE="https://github.com/mautic/mautic/releases/download/${MAUTIC_VERSION}/${MAUTIC_VERSION}.zip"
RELEASE_API="https://api.github.com/repos/mautic/mautic/releases/tags/${MAUTIC_VERSION}"

# site/mautic-site.php with the site's PHP, in the site's folder. The accounts and the settings travel as base64 of
# a JSON object, in a first line before the script on PHP's standard input: never on a command line, never in a file.
site_script() {
  local payload
  payload="$(ACCOUNT_PASSWORD="$ACCOUNT_PASSWORD" BUILD_ADMIN="$BUILD_ADMIN" BUILD_ADMIN_PASSWORD="$BUILD_ADMIN_PASSWORD" python3 -c '
import base64, json, os
p = os.environ["ACCOUNT_PASSWORD"]
print(base64.b64encode(json.dumps({
    "accounts": [
        {"name": os.environ["BUILD_ADMIN"], "email": os.environ["BUILD_ADMIN"] + "@example.com", "password": os.environ["BUILD_ADMIN_PASSWORD"], "role": "administrator", "firstname": "Build", "lastname": "Administrator"},
        {"name": "administrator", "email": "administrator@example.com", "password": p, "role": "administrator", "firstname": "Administrator", "lastname": "Test"},
        {"name": "marketer", "email": "marketer@example.com", "password": p, "role": "marketer", "firstname": "Marketer", "lastname": "Test"},
        {"name": "sales", "email": "sales@example.com", "password": p, "role": "sales", "firstname": "Sales", "lastname": "Test"},
    ],
    "settings": {"mailer_dsn": "smtp://localhost:1025", "site_url": "https://" + os.environ.get("HOST", "")},
}).encode()).decode())')"
  { printf '<?php $SITE_PAYLOAD = "%s"; ?>' "$payload"; cat "$SCRIPT"; } | ddev exec -d "$SITE" "php -- $*"
}
export HOST

# The site's own console, in the web container.
site_console() {
  ddev exec -d "$SITE" "php bin/console --no-ansi $*" < /dev/null
}

mkdir -p "$SITE_DIR"
cd "$SITE_DIR"

if [ "${ACCOUNTS_ONLY:-}" = "1" ]; then
  site_script accounts
  exit 0
fi
if [ "${TIDY_ONLY:-}" = "1" ]; then
  site_script tidy
  site_console cache:pool:clear cache.rate_limiter > /dev/null
  exit 0
fi

# A project of this name from an earlier build goes first, with its database.
if ddev describe "$PROJECT_NAME" > /dev/null 2>&1; then
  ddev delete -Oy "$PROJECT_NAME" < /dev/null
fi
rm -rf mautic .ddev

# A PHP project served by Apache (the release's .htaccess rules), from mautic/, with the project's database (MariaDB
# 10.11, which the release supports) and Node.js 24 for a test suite run in the web container (the site needs none).
ddev config --project-type=php --docroot=mautic --webserver-type=apache-fpm --php-version="$PHP_VERSION" \
  --database=mariadb:10.11 --project-name="$PROJECT_NAME" --nodejs-version=24 < /dev/null

# The site's scheduled tasks, a daemon of the project: the segments, then the campaigns, every 15 seconds. Before the
# install the commands fail, and the loop goes on.
cat > .ddev/config.mautic.yaml <<YAMLEOF
# The site of this project (written by the build script of the step pack): its release, and its scheduled tasks.
web_environment:
  - MAUTIC_VERSION=${MAUTIC_VERSION}
web_extra_daemons:
  - name: scheduled-tasks
    command: "bash -c 'while true; do php bin/console mautic:segments:update --no-interaction --quiet; php bin/console mautic:campaigns:update --no-interaction --quiet; php bin/console mautic:campaigns:trigger --no-interaction --quiet; sleep 15; done > /dev/null 2>&1'"
    directory: ${SITE}
YAMLEOF

ddev start -y < /dev/null

# The release package, checked against the SHA-256 sum its publisher gives beside it (the digest of the release's
# asset).
echo "Getting Mautic ${MAUTIC_VERSION}."
ddev exec "set -e; cd /tmp && curl -sSfL --retry 3 -o mautic.zip '${PACKAGE}' \
  && curl -sSfL --retry 3 -H 'Accept: application/vnd.github+json' -o release.json '${RELEASE_API}' \
  && SUM=\$(php -r '\$r = json_decode(file_get_contents(\"release.json\"), true); foreach (\$r[\"assets\"] as \$a) { if (\$a[\"name\"] === \"${MAUTIC_VERSION}.zip\") { echo substr(\$a[\"digest\"], 7); } }') \
  && test -n \"\$SUM\" && echo \"\$SUM  mautic.zip\" | sha256sum -c - \
  && mkdir -p ${SITE} && unzip -q -o mautic.zip -d ${SITE} && rm -f mautic.zip release.json" < /dev/null

# The site's own command-line installer, on the project's database. The administrator it makes gets a password of
# one use here, which the accounts below replace.
ddev exec -d "$SITE" "php bin/console mautic:install '${SITE_URL}' --force --no-interaction \
  --db_driver=pdo_mysql --db_host=db --db_port=3306 --db_name=db --db_user=db --db_password=db --db_backup_tables=false \
  --admin_firstname=Build --admin_lastname=Administrator --admin_username='${BUILD_ADMIN}' --admin_email='${BUILD_ADMIN}@example.com' \
  --admin_password=\"\$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 20)Aa1!\"" < /dev/null

# The settings of a test site, read again by the site once its cache is cleared; the accounts; the test content.
site_script settings < /dev/null
site_console cache:clear > /dev/null
site_script accounts content < /dev/null

# The segments and the campaigns once now, so the first run finds them built.
for task in mautic:segments:update mautic:campaigns:update mautic:campaigns:trigger; do
  site_console "$task" > /dev/null
done

code=""
for attempt in $(seq 1 30); do
  # The site sends a plain HTTP request on to HTTPS: ask the web server on its HTTPS port, as the router does.
  code="$(ddev exec "curl -sk -o /dev/null -w '%{http_code}' https://127.0.0.1/s/login" < /dev/null 2>/dev/null | tr -d '\r' || true)"
  [ "$code" = "200" ] && break
  sleep 2
done
if [ "$code" != "200" ]; then
  echo "The site did not answer (${code}); the end of the web container's log:" >&2
  ddev logs -s web --tail 60 < /dev/null >&2 || true
  exit 1
fi

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "LAUNCH_URL=$SITE_URL" >> "$GITHUB_ENV"
fi
RELEASE="$(site_script version < /dev/null | tr -d '\r' | tail -n 1)"
echo "Built ${RELEASE} at ${SITE_URL}, its mail at ${SITE_URL}:8026"
