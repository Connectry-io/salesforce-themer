// Server-side CSS allowlist validator for the Connectry Intelligence Layer.
// Runs on every patch heading to the `global` tier. See SECURITY.md
// ("CSS allowlist") for the full rule set + rationale.
//
// Returns { ok: true } or { ok: false, reason: "<short id>: <details>" }.

export type ValidationResult =
  | { ok: true }
  | { ok: false, reason: string };

// Properties allowed on the right-hand side of a declaration. Case-insensitive.
const ALLOWED_PROPERTIES = new Set([
  // colors / paint
  "color", "background", "background-color", "background-image",
  "background-position", "background-repeat", "background-size",
  "background-clip", "background-origin", "background-attachment",
  "fill", "stroke", "stroke-width",
  // borders / outlines / shadows
  "border", "border-top", "border-right", "border-bottom", "border-left",
  "border-color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
  "border-style", "border-top-style", "border-right-style", "border-bottom-style", "border-left-style",
  "border-width", "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
  "border-radius", "border-top-left-radius", "border-top-right-radius",
  "border-bottom-left-radius", "border-bottom-right-radius",
  "outline", "outline-color", "outline-style", "outline-width", "outline-offset",
  "box-shadow", "text-shadow",
  // box / layout (recolor support)
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "display", "position", "top", "right", "bottom", "left",
  "width", "height", "max-width", "max-height", "min-width", "min-height",
  "z-index", "overflow", "overflow-x", "overflow-y",
  "box-sizing", "flex", "flex-direction", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis",
  "justify-content", "align-items", "align-self", "gap", "row-gap", "column-gap",
  "grid-template-columns", "grid-template-rows", "grid-column", "grid-row", "grid-area",
  // typography
  "font", "font-family", "font-size", "font-weight", "font-style", "font-variant",
  "letter-spacing", "line-height", "word-spacing", "white-space",
  "text-align", "text-decoration", "text-decoration-color", "text-decoration-style",
  "text-transform", "text-indent", "text-overflow", "text-shadow",
  // effects
  "opacity", "filter", "backdrop-filter",
  "transform", "transform-origin", "transform-style",
  "transition", "transition-property", "transition-duration", "transition-timing-function", "transition-delay",
  "animation", "animation-name", "animation-duration", "animation-timing-function",
  "animation-delay", "animation-iteration-count", "animation-direction",
  "animation-fill-mode", "animation-play-state",
  "mix-blend-mode",
  // misc safe
  "cursor", "pointer-events", "user-select", "visibility",
  // SLDS theming via custom properties
  "--lwc-fontfamily", "--lwc-fontfamilyheading",
  // any --slds-* / --lwc-* / --theme-* / --dxp-* custom property is allowed (handled below)
  "content",
]);

const FORBIDDEN_AT_RULES = new Set([
  "@import", "@font-face", "@charset", "@namespace", "@page", "@document",
  "@-moz-document", "@viewport",
]);
const ALLOWED_AT_RULES = new Set(["@media", "@supports", "@keyframes", "@-webkit-keyframes"]);

const FORBIDDEN_TOKENS = [
  "expression(",          // legacy IE
  "-moz-binding",         // legacy XBL
  "behavior:url",
  "javascript:",
  "vbscript:",
];

const SUSPICIOUS_ATTR_SELECTOR_TARGETS = new Set([
  "value", "password", "name", "placeholder", "aria-label", "title", "data-name", "data-email",
]);

export function validatePatchCSS(css: string): ValidationResult {
  if (!css || typeof css !== "string") return { ok: false, reason: "empty-css" };
  if (css.length > 200_000) return { ok: false, reason: "size: patch over 200 KB" };

  const lower = css.toLowerCase();

  // Forbidden raw tokens.
  for (const tok of FORBIDDEN_TOKENS) {
    if (lower.includes(tok)) return { ok: false, reason: `forbidden-token: '${tok}'` };
  }

  // url(...) — only data: and #fragment allowed. cursor:url is blocked outright.
  const cursorUrl = /cursor\s*:\s*[^;]*url\s*\(/i;
  if (cursorUrl.test(css)) return { ok: false, reason: "cursor-url: cursor:url() is blocked" };

  const urlPattern = /url\s*\(\s*(['"]?)([^)'"]*)\1\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = urlPattern.exec(css)) !== null) {
    const target = m[2].trim();
    if (target.startsWith("data:") || target.startsWith("#")) continue;
    return { ok: false, reason: `url-not-allowed: ${target.slice(0, 80)}` };
  }

  // CSS escapes (\nn) are blocked anywhere except inside string literals — too risky
  // to parse precisely, so we just block bare escape sequences of 2+ hex digits.
  const escapePattern = /\\[0-9a-f]{2,}/i;
  if (escapePattern.test(css.replace(/(['"])(?:\\.|[^\\])*?\1/g, ""))) {
    return { ok: false, reason: "css-escape: backslash-hex escapes outside strings" };
  }

  // At-rule scan.
  const atRulePattern = /@[a-z-]+/gi;
  while ((m = atRulePattern.exec(css)) !== null) {
    const at = m[0].toLowerCase();
    if (ALLOWED_AT_RULES.has(at)) continue;
    if (FORBIDDEN_AT_RULES.has(at)) return { ok: false, reason: `forbidden-at-rule: ${at}` };
    if (at.startsWith("@-")) return { ok: false, reason: `vendor-at-rule: ${at}` };
    return { ok: false, reason: `unknown-at-rule: ${at}` };
  }

  // Strip /* ... */ comments before per-rule analysis.
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");

  // Walk rules naively. We don't need a full parser — we need defense in depth.
  // Each "rule" = selector { decl; decl; }. We split on '}' and inspect.
  const rules = stripped.split("}");
  for (let idx = 0; idx < rules.length; idx++) {
    const chunk = rules[idx];
    const braceAt = chunk.indexOf("{");
    if (braceAt < 0) continue; // trailing whitespace / @rule-only blocks

    const selector = chunk.slice(0, braceAt).trim();
    const decls = chunk.slice(braceAt + 1);

    // Skip @media/@supports/@keyframes block headers — they don't have property declarations directly.
    if (selector.startsWith("@")) continue;

    // Selector check: no attribute selectors of form [attr^="..."] / $= / *= on sensitive attrs.
    const attrSelPattern = /\[\s*([a-zA-Z-]+)\s*([\^\$\*])=/g;
    let asm: RegExpExecArray | null;
    while ((asm = attrSelPattern.exec(selector)) !== null) {
      const attr = asm[1].toLowerCase();
      const op = asm[2];
      if (SUSPICIOUS_ATTR_SELECTOR_TARGETS.has(attr)) {
        return { ok: false, reason: `attr-selector-exfil: [${attr}${op}=] in '${selector.slice(0, 80)}'` };
      }
    }

    // Declaration check: each `prop: value;` — prop must be in allowlist or be a custom property.
    const declList = decls.split(";");
    for (const raw of declList) {
      const d = raw.trim();
      if (!d) continue;
      const colonAt = d.indexOf(":");
      if (colonAt < 0) continue;
      const prop = d.slice(0, colonAt).trim().toLowerCase();
      // CSS custom properties always allowed (--foo).
      if (prop.startsWith("--")) continue;
      if (!ALLOWED_PROPERTIES.has(prop)) {
        return { ok: false, reason: `forbidden-property: '${prop}' in '${selector.slice(0, 60)}'` };
      }
    }
  }

  return { ok: true };
}
