#!/usr/bin/env bash
set -euo pipefail
# Official prebuilt CLI avoids the npm installer's incompatible tar default import.
test "$(uname -s)" = Linux
test "$(uname -m)" = x86_64
install_dir="${RUNNER_TEMP:?RUNNER_TEMP is required}/eventdesk-railway"
mkdir -p "$install_dir"
archive="$install_dir/railway.tar.gz"
curl --fail --silent --show-error --location --retry 3 \
  https://github.com/railwayapp/cli/releases/download/v5.52.0/railway-v5.52.0-x86_64-unknown-linux-musl.tar.gz \
  --output "$archive"
printf '%s  %s\n' '4f713297e1734075ba7fd6e889ae5e07af2192c50d94b212af6d7e301cad45c3' "$archive" | sha256sum --check --strict
tar -xzf "$archive" -C "$install_dir" railway
chmod 755 "$install_dir/railway"
"$install_dir/railway" --version
printf '%s\n' "$install_dir" >> "${GITHUB_PATH:?GITHUB_PATH is required}"
