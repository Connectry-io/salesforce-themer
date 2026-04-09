#!/usr/bin/env python3
"""
Sync themes/engine.js into background.js.
Replaces the generateThemeCSS + hexToRgb functions in background.js
with the latest from engine.js (source of truth).

Usage: python3 scripts/sync-engine.py
"""

import re
import sys

ENGINE_PATH = 'themes/engine.js'
BG_PATH = 'background.js'

# Read files
with open(ENGINE_PATH) as f:
    engine = f.read()

with open(BG_PATH) as f:
    bg = f.read()

# Extract from engine.js: everything from 'function generateThemeCSS'
# up to (but NOT including) the module.exports block or EOF marker
match = re.search(
    r'(function generateThemeCSS\(theme\).*?)(?=\n// Export for use|\nif \(typeof module)',
    engine,
    re.DOTALL
)
if not match:
    print('ERROR: Could not find generateThemeCSS in engine.js')
    sys.exit(1)

engine_code = match.group(1).rstrip()

# Safety check: engine code must NOT contain module.exports
if 'module.exports' in engine_code or 'typeof module' in engine_code:
    print('ERROR: Engine code contains module.exports — extraction boundary is wrong')
    sys.exit(1)

# Replace in background.js: from 'function generateThemeCSS'
# up to '// ─── Inline: derivation engine'
bg_match = re.search(
    r'function generateThemeCSS\(theme\).*?(?=\n// ─── Inline: derivation engine)',
    bg,
    re.DOTALL
)
if not bg_match:
    print('ERROR: Could not find engine boundaries in background.js')
    sys.exit(1)

new_bg = bg[:bg_match.start()] + engine_code + '\n' + bg[bg_match.end():]

# Safety: remove any orphaned module.exports that leaked in
new_bg = re.sub(r'\nif \(typeof module !== .undefined.\) \{\n', '\n', new_bg)

with open(BG_PATH, 'w') as f:
    f.write(new_bg)

print(f'Synced {len(engine_code)} chars from {ENGINE_PATH} into {BG_PATH}')
