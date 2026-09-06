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

# Ponytail — "tembel kıdemli geliştirici" disiplini (MIT, @dietrichgebert/ponytail).
# native-core.md'nin 4. maddesiyle ("gerçekten doğru olan en küçük değişiklik")
# aynı yöne bakıyor; farkı, kod yazmadan önce tırmanılan somut bir merdiven
# olması: zaten var mı → stdlib → platformun kendi özelliği → kurulu bağımlılık
# → tek satır.
#
# Neden depoya kopyalanmıyor: dosyalar bu deponun malı değil, sürümleri npm'de,
# ve NOTICE.md'nin çizdiği lisans sınırı .claude/skills/ içini "burada yazıldı"
# olarak tanımlıyor. graphify ve supabase ile aynı sınıf: konteyner unutuyor,
# hook geri getiriyor.
#
# npm paketi `skills/` dizinini olduğu gibi yayımlıyor — git checkout'uyla
# birebir aynı olduğu `diff -r` ile ölçüldü, o yüzden klonlamaya gerek yok.
#
# supabase bloğu gibi dizine bakarak korunuyor, `command -v` ile değil: bu
# kurulum bir binary bırakmıyor, yalnızca SKILL.md dosyaları.
#
# Bu kurulum skill katmanı: /ponytail, /ponytail-review, /ponytail-audit,
# /ponytail-debt, /ponytail-gain, /ponytail-help çağrıldığında çalışır. Her
# isteme otomatik enjeksiyon (plugin katmanı) bilerek açılmadı — onu istersen
# `/plugin marketplace add DietrichGebert/ponytail`.
if [ -d "$HOME/.claude/skills/ponytail" ]; then
  echo "ponytail skills already present"
else
  echo "installing ponytail skills..."
  PONYTAIL_TMP="$(mktemp -d)"
  if npm i --no-save --silent --prefix "$PONYTAIL_TMP" @dietrichgebert/ponytail >/dev/null 2>&1 \
    && mkdir -p "$HOME/.claude/skills" \
    && cp -r "$PONYTAIL_TMP/node_modules/@dietrichgebert/ponytail/skills/." "$HOME/.claude/skills/"; then
    echo "ponytail skills installed"
  else
    echo "ponytail skills install skipped (offline?)" >&2
  fi
  rm -rf "$PONYTAIL_TMP"
fi

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
