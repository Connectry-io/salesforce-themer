# Graph Report - .  (2026-04-11)

## Corpus Check
- 28 files · ~64,429 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 299 nodes · 603 edges · 21 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `init()` - 28 edges
2. `getThemeById()` - 21 edges
3. `init()` - 21 edges
4. `openEditor()` - 14 edges
5. `saveCustomTheme()` - 13 edges
6. `init()` - 13 edges
7. `selectTheme()` - 10 edges
8. `getFullEditorTheme()` - 10 edges
9. `SFThemerParticles` - 10 edges
10. `applyTheme()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `openEditor()` --calls--> `isPremium()`  [EXTRACTED]
  options/options.js → options/options.js  _Bridges community 16 → community 15_
- `saveCustomTheme()` --calls--> `isPremium()`  [EXTRACTED]
  options/options.js → options/options.js  _Bridges community 16 → community 5_
- `renderEffectsGrid()` --calls--> `isPremium()`  [EXTRACTED]
  options/options.js → options/options.js  _Bridges community 16 → community 6_
- `renderCustomThemeGrid()` --calls--> `getThemeById()`  [EXTRACTED]
  options/options.js → options/options.js  _Bridges community 6 → community 5_
- `openCreationDialog()` --calls--> `getThemeById()`  [EXTRACTED]
  options/options.js → options/options.js  _Bridges community 6 → community 15_

## Communities

### Community 0 - "Community 0"
Cohesion: 0.1
Nodes (36): activateThemeTab(), applyPremiumStateToPopup(), applyThemeToTab(), bindEffectsSelector(), bindHelpTooltip(), bindOptionsButton(), bindPerOrgToggle(), bindResetSettings() (+28 more)

### Community 1 - "Community 1"
Cohesion: 0.1
Nodes (20): _bindBuilderCreateMenu(), _bindChatDrawer(), bindDevPanel(), _bindFaviconToggle(), bindFilterPills(), bindOptEffectsPills(), bindOptResetSettings(), bindOptSettingsCardCollapse() (+12 more)

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (21): _alpha(), applyAndSaveTheme(), broadcastThemeToActiveTabs(), cacheAllThemes(), cacheCustomThemeCSS(), cacheThemeCSS(), _contrast(), _darken() (+13 more)

### Community 3 - "Community 3"
Cohesion: 0.16
Nodes (26): applyEffects(), applyFavicon(), applyTheme(), applyThemeFast(), beginTransition(), _buildFaviconSVG(), destroyCanvasEffects(), endTransition() (+18 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (10): _buildBackgroundPatternCss(), _deriveAuroraColors(), generateEffectsCSS(), _hexToRgb(), _hslToHex(), _intensityMult(), _parseHex(), _rgbToHsl() (+2 more)

### Community 5 - "Community 5"
Cohesion: 0.17
Nodes (15): _buildMiniSwatch(), _containsProfanity(), deleteCustomTheme(), _flashToast(), handleAutoModeToggle(), pushThemeToAllSfTabs(), renderBuilderSidebar(), renderCustomThemeGrid() (+7 more)

### Community 6 - "Community 6"
Cohesion: 0.18
Nodes (14): _capitalize(), getThemeById(), isDarkTheme(), isLightTheme(), openEffectsResetMenu(), _previewLabel(), renderEffectsGrid(), renderOrgList() (+6 more)

### Community 7 - "Community 7"
Cohesion: 0.33
Nodes (12): _alpha(), _contrast(), _darken(), deriveFullTheme(), extractCoreValues(), _hslToRgb(), _lighten(), _mix() (+4 more)

### Community 8 - "Community 8"
Cohesion: 0.23
Nodes (3): CxDialog, CxTabs, _escape()

### Community 9 - "Community 9"
Cohesion: 0.22
Nodes (11): applyEditorPreviewEffects(), applyEditorPreviewTypography(), _applyPreviewVars(), deriveFullTheme(), exportThemeJSON(), getEditorCoreValues(), getFullEditorTheme(), _hexToRgbCsv() (+3 more)

### Community 10 - "Community 10"
Cohesion: 0.42
Nodes (10): alpha(), contrast(), darken(), hexToRgb(), hslToRgb(), lighten(), mix(), parseColor() (+2 more)

### Community 11 - "Community 11"
Cohesion: 0.27
Nodes (7): applyVolume(), getPresetDisplayInfo(), getPresetNames(), getSuggestedConfig(), getThemeEffects(), initialCustomThemeEffects(), resolveActiveEffects()

### Community 12 - "Community 12"
Cohesion: 0.27
Nodes (11): _alpha(), bindAdvancedEvents(), _contrast(), _darken(), _fromHsl(), _hex(), _lighten(), _mix() (+3 more)

### Community 13 - "Community 13"
Cohesion: 0.25
Nodes (9): applyThemeFilter(), _bindGuideAnatomyInteractions(), buildEffectIndicators(), buildSwatch(), _connectryDotSvg(), _detectThemeCategory(), renderGuideAnatomyDiagram(), renderThemeGrid() (+1 more)

### Community 14 - "Community 14"
Cohesion: 0.22
Nodes (9): _applyGuidePlaygroundIntensity(), _bindGuideColorsInteractions(), _bindGuideTypeDemo(), renderEffectsTabForActiveTheme(), renderGuideColorsMock(), renderGuideEffectsGrid(), renderGuideTab(), saveEffectsConfig() (+1 more)

### Community 15 - "Community 15"
Cohesion: 0.29
Nodes (8): defaultTypography(), _ensureEditorLoaded(), getSuggestedEffectsFor(), openCreationDialog(), openEditor(), populateTypographyUI(), renderEditorEffectsGrid(), switchEditorSubtab()

### Community 16 - "Community 16"
Cohesion: 0.33
Nodes (6): bindEditorEvents(), _bindTopbarActions(), _guardPremium(), isPremium(), openUpgradeDialog(), syncPremiumBodyClass()

### Community 17 - "Community 17"
Cohesion: 0.47
Nodes (6): _bindEditorFaviconPopout(), _bindGuideFaviconDemo(), _loadEditorFaviconState(), _renderFaviconSVG(), _updateEditorFaviconPreview(), _updateGuideFaviconPreview()

### Community 18 - "Community 18"
Cohesion: 0.83
Nodes (3): generateThemeCSS(), _generateTypographyCSS(), hexToRgb()

### Community 19 - "Community 19"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 19`** (1 nodes): `storage.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (1 nodes): `sync-engine.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `init()` connect `Community 1` to `Community 5`, `Community 6`, `Community 13`, `Community 14`, `Community 15`, `Community 16`, `Community 17`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._