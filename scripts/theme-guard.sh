#!/usr/bin/env bash
# theme-guard: impide que vuelva a entrar color hardcodeado al frontend.
#
# Regla del repo: todos los colores viven como tokens en web/src/app/theme.css
# y se consumen vía clases semánticas de Tailwind (bg-background, text-danger,
# bg-role-pilot, ...) o var(--token). Excepciones documentadas en la allowlist.
set -euo pipefail

cd "$(dirname "$0")/.."

SRC=web/src

# Excepciones (rutas relativas a web/src). Mantener en sintonía con web/CLAUDE.md.
ALLOWLIST='app/theme\.css|features/ratings/utils/colors\.ts|shared/components/common/glassColors\.ts|shared/components/common/GlassProgressBar|components/ui/chart\.tsx|components/ui/button\.tsx|components/ui/badge\.tsx|types/generated/'

fail=0

# 1) Colores CSS crudos (hex, rgb/rgba, hsl/hsla, oklch) en TS/TSX/CSS.
#    Se permiten las funciones de color cuyo argumento es un var(--token).
raw=$(grep -rnE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(' \
        --include='*.ts' --include='*.tsx' --include='*.css' "$SRC" \
      | grep -vE "$SRC/($ALLOWLIST)" \
      | grep -vE '(rgba?|hsla?|oklch)\(\s*var\(--' || true)
if [ -n "$raw" ]; then
  echo "::error::Colores CSS crudos fuera de app/theme.css (usa tokens var(--...)):"
  echo "$raw"
  fail=1
fi

# 2) Clases Tailwind de paleta literal (bg-red-500, text-gray-400, ...) y
#    bg/text-white|black sin alpha. Los overlays bg-black/NN (scrims) se permiten.
palette=$(grep -rnP '\b(bg|text|border|ring|fill|stroke|from|via|to|divide|placeholder|shadow|outline|decoration|accent|caret)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]+(?![\w-])|\b(bg|text|border)-(white|black)(?![/\w-])' \
        --include='*.ts' --include='*.tsx' "$SRC" \
      | grep -vE "$SRC/($ALLOWLIST)" || true)
if [ -n "$palette" ]; then
  echo "::error::Clases Tailwind de paleta literal (usa tokens semánticos: text-muted-foreground, bg-danger, ...):"
  echo "$palette"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "theme-guard OK: sin colores hardcodeados fuera de las excepciones."
fi
exit $fail
