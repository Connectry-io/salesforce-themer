async function loadThemes() {
  try {
    var url = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
      ? chrome.runtime.getURL('themes/themes.json')
      : '../themes/themes.json';
    var resp = await fetch(url);
    if (!resp.ok) throw new Error('Fetch failed: ' + resp.status);
    var data = await resp.json();
    return data.themes;
  } catch (err) {
    document.getElementById('status').innerHTML = '<div style="color:#ef4444">Error loading themes: ' + err.message + '</div>';
    throw err;
  }
}

function drawConnectryLogo(ctx, cx, cy, size) {
  var r = size * 0.29, gap = size * 0.5;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx - gap, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = size * 0.12;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - gap + r, cy); ctx.lineTo(cx + gap - r, cy); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx + gap, cy, r, 0, Math.PI * 2); ctx.fill();
}

function renderShareImage(canvas, theme) {
  var W = 1200, H = 630;
  canvas.width = W;
  canvas.height = H;
  var ctx = canvas.getContext('2d');
  var c = theme.colors || {};

  // ─── Dark backdrop ─────────────────────────────────────────────
  var grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(1, '#1e293b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Dot grid
  ctx.fillStyle = 'rgba(255,255,255,0.015)';
  for (var x = 12; x < W; x += 20) {
    for (var y = 12; y < H; y += 20) {
      ctx.beginPath(); ctx.arc(x, y, 0.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ─── TOP: Theme name (centered) ───────────────────────────────
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px Inter, system-ui, sans-serif';
  ctx.fillText(theme.name, W / 2, 36);

  // Color swatch strip below name
  var swatchColors = [c.nav, c.accent, c.background, c.surface, c.textPrimary].filter(Boolean);
  var swatchW = 24, swatchGap = 4;
  var totalSwatchW = swatchColors.length * swatchW + (swatchColors.length - 1) * swatchGap;
  var swatchStartX = (W - totalSwatchW) / 2;
  swatchColors.forEach(function(col, i) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.roundRect(swatchStartX + i * (swatchW + swatchGap), 48, swatchW, 10, 3);
    ctx.fill();
  });

  // ─── CENTER: Browser preview (proportional, centered) ──────────
  // Preview is 16:10 aspect, sized to fill nicely with breathing room
  var previewW = 900;
  var previewH = 440;
  var previewX = (W - previewW) / 2;
  var previewY = 72;
  var barH = 28;

  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 8;

  // Browser chrome
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.roundRect(previewX, previewY, previewW, barH, [8, 8, 0, 0]);
  ctx.fill();

  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  // Traffic lights
  ['#ff5f57', '#ffbd2e', '#28c840'].forEach(function(col, i) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(previewX + 16 + i * 14, previewY + 14, 4, 0, Math.PI * 2); ctx.fill();
  });

  // Tab
  ctx.fillStyle = '#334155';
  ctx.beginPath(); ctx.roundRect(previewX + 56, previewY + 5, 140, 18, [4, 4, 0, 0]); ctx.fill();
  ctx.fillStyle = '#94a3b8';
  ctx.font = '9px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Jack Popescu | Lead | S...', previewX + 66, previewY + 17);
  // Tab close
  ctx.fillStyle = '#64748b';
  ctx.font = '8px Inter, system-ui, sans-serif';
  ctx.fillText('\u00d7', previewX + 184, previewY + 17);
  // + tab
  ctx.fillStyle = '#64748b';
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.fillText('+', previewX + 202, previewY + 18);

  // ─── App content ───────────────────────────────────────────────
  var appX = previewX, appY = previewY + barH;
  var appW = previewW, appH = previewH - barH;

  // Background
  ctx.fillStyle = c.background || '#f7f7f5';
  ctx.beginPath(); ctx.roundRect(appX, appY, appW, appH, [0, 0, 8, 8]); ctx.fill();

  // ── Global header (white bar with search) ──
  var ghH = 32;
  ctx.fillStyle = c.surface || '#ffffff';
  ctx.fillRect(appX, appY, appW, ghH);
  ctx.strokeStyle = c.border || '#e8e8e6';
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(appX, appY + ghH); ctx.lineTo(appX + appW, appY + ghH); ctx.stroke();

  // Waffle
  ctx.fillStyle = c.textSecondary || '#4a5568';
  for (var wr = 0; wr < 3; wr++) {
    for (var wc = 0; wc < 3; wc++) {
      ctx.beginPath(); ctx.arc(appX + 16 + wc * 5, appY + 11 + wr * 5, 1.2, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Search
  ctx.fillStyle = c.surfaceAlt || '#eeeeed';
  ctx.beginPath(); ctx.roundRect(appX + 38, appY + 7, 180, 18, 9); ctx.fill();
  ctx.fillStyle = c.textPlaceholder || '#9aa5b4';
  ctx.font = '9px Inter, system-ui, sans-serif';
  ctx.fillText('Search...', appX + 54, appY + 20);

  // Right-side icons
  var iconX = appX + appW - 20;
  ctx.fillStyle = c.accent || '#4a6fa5';
  ctx.beginPath(); ctx.arc(iconX, appY + 16, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 8px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', iconX, appY + 19);
  ctx.textAlign = 'left';

  // + icon
  ctx.strokeStyle = c.textSecondary || '#4a5568';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(iconX - 30, appY + 12); ctx.lineTo(iconX - 30, appY + 20); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(iconX - 34, appY + 16); ctx.lineTo(iconX - 26, appY + 16); ctx.stroke();

  // ── Nav bar ──
  var navY = appY + ghH;
  var navH = 34;
  ctx.fillStyle = c.nav || '#4a6fa5';
  ctx.fillRect(appX, navY, appW, navH);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px Inter, system-ui, sans-serif';
  var navItems = ['Sales', 'Home', 'Leads', 'Contacts', 'Accounts'];
  navItems.forEach(function(item, i) {
    ctx.fillText(item, appX + 20 + i * 72, navY + 22);
  });
  // Active underline on Leads
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(appX + 20 + 2 * 72, navY + navH - 3, 38, 3);

  // ── Record page content ──
  var recY = navY + navH + 6;
  var recMargin = 20;

  // Page title
  ctx.fillStyle = c.textPrimary || '#2d2d2d';
  ctx.font = 'bold 16px Inter, system-ui, sans-serif';
  ctx.fillText('Lead: John Smith', appX + recMargin, recY + 16);

  ctx.fillStyle = c.textSecondary || '#4a5568';
  ctx.font = '9px Inter, system-ui, sans-serif';
  ctx.fillText('Senior Account Executive', appX + recMargin, recY + 30);

  // Clone button
  ctx.fillStyle = c.buttonNeutralBg || c.surface || '#ffffff';
  ctx.strokeStyle = c.buttonNeutralBorder || c.border || '#c4cdd6';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.roundRect(appX + appW - recMargin - 140, recY + 4, 60, 22, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.buttonNeutralText || c.textPrimary || '#2d2d2d';
  ctx.font = 'bold 9px Inter, system-ui, sans-serif';
  ctx.fillText('Clone', appX + appW - recMargin - 122, recY + 19);

  // Convert button
  ctx.fillStyle = c.buttonBrandBg || c.accent || '#4a6fa5';
  ctx.beginPath(); ctx.roundRect(appX + appW - recMargin - 72, recY + 4, 72, 22, 4); ctx.fill();
  ctx.fillStyle = c.buttonBrandText || '#ffffff';
  ctx.fillText('Convert', appX + appW - recMargin - 54, recY + 19);

  // ── Main card ──
  var cardX = appX + recMargin, cardY = recY + 42;
  var cardW = appW - recMargin * 2, cardH = appH - (cardY - appY) - 28;

  ctx.fillStyle = c.surface || '#ffffff';
  ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, 6); ctx.fill();
  ctx.strokeStyle = c.border || '#e8e8e6';
  ctx.lineWidth = 0.6;
  ctx.stroke();

  // Path / Stage
  var stages = ['New', 'Working', 'Converted'];
  stages.forEach(function(label, i) {
    var px = cardX + 14 + i * 96;
    ctx.fillStyle = i < 2 ? (c.accent || '#4a6fa5') : (c.surfaceAlt || '#eee');
    ctx.beginPath(); ctx.roundRect(px, cardY + 12, 88, 20, 10); ctx.fill();
    ctx.fillStyle = i < 2 ? '#ffffff' : (c.textSecondary || '#4a5568');
    ctx.font = '8px Inter, system-ui, sans-serif';
    ctx.fillText(label, px + (i === 2 ? 24 : 30), cardY + 25);
  });

  // Tabs
  var tabY = cardY + 42;
  ctx.fillStyle = c.tabActiveColor || c.accent || '#4a6fa5';
  ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.fillText('Details', cardX + 14, tabY);
  ctx.fillRect(cardX + 14, tabY + 4, 34, 2);
  ctx.fillStyle = c.tabInactiveColor || c.textSecondary || '#4a5568';
  ctx.fillText('Activity', cardX + 66, tabY);
  ctx.fillText('Chatter', cardX + 122, tabY);
  ctx.strokeStyle = c.tabNavBorder || c.border || '#e8e8e6';
  ctx.lineWidth = 0.4;
  ctx.beginPath(); ctx.moveTo(cardX + 6, tabY + 7); ctx.lineTo(cardX + cardW - 6, tabY + 7); ctx.stroke();

  // Detail rows
  var rows = [['Name', 'John Smith'], ['Email', 'john@example.com'], ['Company', 'Acme Corp'], ['Phone', '+1 (555) 123-4567']];
  rows.forEach(function(row, i) {
    var ry = tabY + 22 + i * 22;
    ctx.fillStyle = c.textSecondary || '#64748b';
    ctx.font = '9px Inter, system-ui, sans-serif';
    ctx.fillText(row[0], cardX + 14, ry);
    ctx.fillStyle = row[0] === 'Email' ? (c.link || c.accent || '#4a6fa5') : (c.textPrimary || '#1e293b');
    ctx.fillText(row[1], cardX + 130, ry);
    ctx.strokeStyle = c.tableBorderRow || c.border || '#e8e8e6';
    ctx.lineWidth = 0.3;
    ctx.beginPath(); ctx.moveTo(cardX + 8, ry + 8); ctx.lineTo(cardX + cardW - 8, ry + 8); ctx.stroke();
  });

  // Edit / Delete
  var btnY = tabY + 22 + rows.length * 22 + 6;
  ctx.fillStyle = c.buttonNeutralBg || c.surface || '#ffffff';
  ctx.strokeStyle = c.buttonNeutralBorder || c.border || '#c4cdd6';
  ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.roundRect(cardX + 14, btnY, 42, 18, 3); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(cardX + 62, btnY, 50, 18, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.buttonNeutralText || c.textPrimary || '#2d2d2d';
  ctx.font = 'bold 8px Inter, system-ui, sans-serif';
  ctx.fillText('Edit', cardX + 28, btnY + 12);
  ctx.fillText('Delete', cardX + 76, btnY + 12);

  // Toast
  var toastY = btnY + 26;
  if (toastY + 18 < cardY + cardH - 2) {
    ctx.fillStyle = c.success || '#059669';
    ctx.globalAlpha = 0.1;
    ctx.beginPath(); ctx.roundRect(cardX + 8, toastY, cardW - 16, 18, 3); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = c.success || '#059669';
    ctx.font = '8px Inter, system-ui, sans-serif';
    ctx.fillText('\u2713 Lead "John Smith" was saved.', cardX + 20, toastY + 12);
    ctx.fillStyle = c.link || c.accent || '#4a6fa5';
    ctx.font = 'bold 8px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Undo', cardX + cardW - 16, toastY + 12);
    ctx.textAlign = 'left';
  }

  // Footer utility bar
  var footerY = appY + appH - 20;
  ctx.fillStyle = c.nav || '#4a6fa5';
  ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.roundRect(appX, footerY, appW, 20, [0, 0, 8, 8]); ctx.fill();
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#ffffff';
  ctx.font = '7px Inter, system-ui, sans-serif';
  ctx.fillText('\u2261 Notes', appX + 16, footerY + 13);
  ctx.fillText('\u25cb History', appX + 72, footerY + 13);
  ctx.fillText('\u25a1 Open CTI', appX + 138, footerY + 13);
  ctx.globalAlpha = 1;

  // ─── BOTTOM: Branding (stacked, centered) ─────────────────────
  ctx.textAlign = 'center';

  // Logo + "Salesforce Themer" on same line
  drawConnectryLogo(ctx, W / 2 - 68, H - 26, 12);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 14px Inter, system-ui, sans-serif';
  ctx.fillText('Salesforce Themer', W / 2 + 4, H - 22);

  // "Built with care by Connectry"
  ctx.fillStyle = '#64748b';
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.fillText('Built with care by Connectry', W / 2, H - 9);
}

document.getElementById('generateBtn').addEventListener('click', async function() {
  var status = document.getElementById('status');
  var grid = document.getElementById('grid');
  grid.innerHTML = '';
  status.innerHTML = '<div class="status">Loading themes...</div>';
  try {
    var themes = await loadThemes();
    status.innerHTML = '<div class="status">Generating ' + themes.length + ' images...</div>';

    for (var t = 0; t < themes.length; t++) {
      var theme = themes[t];
      var card = document.createElement('div');
      card.className = 'preview';

      var cvs = document.createElement('canvas');
      renderShareImage(cvs, theme);
      card.appendChild(cvs);

      var info = document.createElement('div');
      info.className = 'preview-info';
      var nm = document.createElement('span');
      nm.textContent = theme.name;
      var dl = document.createElement('a');
      dl.textContent = 'Download';
      dl.href = '#';
      (function(c, th) {
        dl.addEventListener('click', function(e) {
          e.preventDefault();
          c.toBlob(function(blob) {
            var u = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = u; a.download = th.id + '.png'; a.click();
            URL.revokeObjectURL(u);
          }, 'image/png');
        });
      })(cvs, theme);
      info.appendChild(nm); info.appendChild(dl);
      card.appendChild(info); grid.appendChild(card);
    }

    status.innerHTML = '<div class="status">\u2713 Generated ' + themes.length + ' images. Click each to download, or use Download All below.</div>';
    var dlAllBtn = document.createElement('button');
    dlAllBtn.className = 'btn-primary';
    dlAllBtn.textContent = 'Download All';
    dlAllBtn.style.marginTop = '12px';
    dlAllBtn.addEventListener('click', function() {
      var cards = grid.querySelectorAll('.preview');
      for (var i = 0; i < cards.length; i++) {
        (function(idx) {
          setTimeout(function() {
            cards[idx].querySelector('canvas').toBlob(function(blob) {
              var u = URL.createObjectURL(blob);
              var a = document.createElement('a');
              a.href = u; a.download = themes[idx].id + '.png'; a.click();
              URL.revokeObjectURL(u);
            }, 'image/png');
          }, idx * 200);
        })(i);
      }
    });
    status.appendChild(dlAllBtn);
  } catch (err) {
    status.innerHTML = '<div style="color:#ef4444">Error: ' + err.message + '</div>';
  }
});
