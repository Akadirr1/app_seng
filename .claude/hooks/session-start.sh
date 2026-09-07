#!/bin/bash
# SessionStart hook.
#
# The cloud container is rebuilt from scratch every session, so anything that
# is not committed to the repo is gone. This restores the one thing that
# matters and is not in git: graphify.
#
# Three traps, all real:
#   1. The package is `graphifyy` (two y's); the command is `graphify` (one y).
#      Typo it and the install fails silently and /graphify never shows up.
#   2. `graphify install` is a separate step. Installing the package is not
#      enough - that command is what registers the skill with the session.
#   3. $HOME/.local/bin must be on PATH, or `uv tool install` succeeds and the
#      command is still not found. The CLAUDE_ENV_FILE line carries that to
#      later shells too.
#
# Idempotent: re-running is harmless.
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"
echo 'export PATH="$HOME/.local/bin:$PATH"' >> "${CLAUDE_ENV_FILE:-/dev/null}" 2>/dev/null || true

# Supabase skills. The AI Gundem port's backend half is Supabase - RLS,
# migrations, edge functions - and these two carry that discipline. Same reason
# as graphify below: they are not in this repo and the container forgets them.
#
# Guarded on the directory, not `command -v`: `skills add` writes files and
# symlinks them into ~/.claude/skills, it does not install a binary, so there is
# no command to look for.
if [ -d "$HOME/.agents/skills/supabase" ]; then
  echo "supabase skills already present"
else
  echo "installing supabase skills..."
  if npx --yes skills add supabase/agent-skills >/dev/null 2>&1; then
    echo "supabase skills installed"
  else
    echo "supabase skills install skipped (offline?)" >&2
  fi
fi

# Ponytail burada kurulmuyor — `.claude/settings.json` kuruyor.
#
# Bir tur bu hook'tan npm ile kuruldu, sonra plugin olarak kurulunca blok
# kaldırıldı: aynı altı skili iki kaynaktan almak, ikisi ayrışana kadar
# çalışan bir kurulum demek. Hook npm'in en güncelini çekiyordu, plugin ise
# bir commit SHA'sına sabitli — yani ayrışma kesindi, sadece zamanı belirsizdi.
#
# settings.json'daki `extraKnownMarketplaces` + `enabledPlugins` ikilisi
# commit'li, dolayısıyla konteyner sıfırlansa da duruyor: bu hook'un çözdüğü
# problem (konteyner unutuyor) plugin tarafında zaten çözülmüş. Üstünde
# skillerin getirmediği üç yaşam döngüsü hook'u var — asıl fark o, bkz. PR #44.
if command -v graphify >/dev/null 2>&1; then
  echo "graphify already present ($(graphify --version 2>&1 | head -1))"
else
  if command -v uv >/dev/null 2>&1; then
    echo "installing graphify..."
    uv tool install graphifyy
  else
    echo "uv not found - skipping graphify install" >&2
    exit 0
  fi
fi

graphify install >/dev/null 2>&1 && echo "graphify skill registered" \
  || echo "graphify skill registration skipped" >&2
