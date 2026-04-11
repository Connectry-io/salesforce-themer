async function loadThemes() {
  try {
    const url = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
      ? chrome.runtime.getURL('themes/themes.json')
      : '../themes/themes.json';
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Fetch failed: ' + resp.status);
    const data = await resp.json();
    return data.themes;
  } catch (err) {
    document.getElementById('status').innerHTML = '<div style="color:#ef4444">Error loading themes: ' + err.message + '</div>';
    throw err;
  }
}

function drawConnectryLogo(ctx, cx, cy, size) {
  // Two connected dots — the Connectry mark
  var r = size * 0.29;
  var gap = size * 0.5;
  // Left dot (graphite)
  ctx.fillStyle = '#2D2D2D';
  ctx.beginPath(); ctx.arc(cx - gap, cy, r, 0, Math.PI * 2); ctx.fill();
  // Connection line (Connectry blue)
  ctx.strokeStyle = '#4A6FA5';
  ctx.lineWidth = size * 0.12;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - gap + r, cy); ctx.lineTo(cx + gap - r, cy); ctx.stroke();
  // Right dot (blue)
  ctx.fillStyle = '#4A6FA5';
  ctx.beginPath(); ctx.arc(cx + gap, cy, r, 0, Math.PI * 2); ctx.fill();
}

function renderShareImage(canvas, theme) {
  var W = 1200, H = 630;
  canvas.width = W;
  canvas.height = H;
  var ctx = canvas.getContext('2d');
  var c = theme.colors || {};

  // ─── Dark Connectry backdrop ────────────────────────────────────
  var grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(1, '#1e293b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle dot grid
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (var x = 20; x < W; x += 28) {
    for (var y = 20; y < H; y += 28) {
      ctx.beginPath();
      ctx.arc(x, y, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Accent glow blobs
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = c.accent || '#4a6fa5';
  ctx.beginPath(); ctx.arc(60, 60, 160, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(W - 60, H - 60, 120, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  // ─── Left side: theme name, tagline, logo, palette ─────────────
  var leftX = 56;
  var leftW = 360;

  // Theme name
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 38px Inter, system-ui, sans-serif';
  ctx.fillText(theme.name, leftX, 80);

  // Tagline
  if (theme.tagline) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '15px Inter, system-ui, sans-serif';
    // Word wrap tagline to ~40 chars
    var words = theme.tagline.split(' ');
    var line = '';
    var lineY = 112;
    for (var i = 0; i < words.length; i++) {
      var test = line + (line ? ' ' : '') + words[i];
      if (ctx.measureText(test).width > leftW) {
        ctx.fillText(line, leftX, lineY);
        line = words[i];
        lineY += 20;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, leftX, lineY);
  }

  // Color palette dots
  var paletteY = 175;
  var dotColors = [c.nav, c.accent, c.surface, c.background, c.textPrimary].filter(Boolean);
  var dotR = 12, dotGap = 10;
  dotColors.forEach(function(col, i) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(leftX + i * (dotR * 2 + dotGap) + dotR, paletteY, dotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // Connectry logo + wordmark at bottom-left
  drawConnectryLogo(ctx, leftX + 22, H - 52, 20);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 16px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Salesforce Themer', leftX + 52, H - 46);
  ctx.fillStyle = '#64748b';
  ctx.font = '12px Inter, system-ui, sans-serif';
  ctx.fillText('Built with care by Connectry', leftX + 52, H - 28);

  // ─── Right side: browser preview (fills right ~60%) ────────────
  var previewX = 430, previewY = 36;
  var previewW = W - previewX - 36;
  var previewH = H - 72;

  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 12;

  // Browser chrome bar
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.roundRect(previewX, previewY, previewW, 32, [10, 10, 0, 0]);
  ctx.fill();

  // Traffic lights
  ['#ff5f57', '#ffbd2e', '#28c840'].forEach(function(col, i) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(previewX + 18 + i * 16, previewY + 16, 4.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Tab
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.roundRect(previewX + 64, previewY + 6, 140, 20, [5, 5, 0, 0]);
  ctx.fill();
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Salesforce | Leads', previewX + 74, previewY + 20);

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // ─── App content area ──────────────────────────────────────────
  var appY = previewY + 32;
  var appH = previewH - 32;

  // Background
  ctx.fillStyle = c.background || '#f7f7f5';
  ctx.beginPath();
  ctx.roundRect(previewX, appY, previewW, appH, [0, 0, 10, 10]);
  ctx.fill();

  // Nav bar
  ctx.fillStyle = c.nav || '#4a6fa5';
  ctx.fillRect(previewX, appY, previewW, 38);

  // Nav items
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px Inter, system-ui, sans-serif';
  ['Sales', 'Home', 'Leads', 'Contacts'].forEach(function(item, i) {
    ctx.fillText(item, previewX + 20 + i * 68, appY + 24);
  });
  // Active underline
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(previewX + 20 + 2 * 68, appY + 32, 40, 2.5);

  // Page header
  var hdrY = appY + 48;
  ctx.fillStyle = c.textPrimary || '#2d2d2d';
  ctx.font = 'bold 16px Inter, system-ui, sans-serif';
  ctx.fillText('Lead: John Smith', previewX + 24, hdrY + 20);
  ctx.fillStyle = c.textSecondary || '#4a5568';
  ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.fillText('Senior Account Executive', previewX + 24, hdrY + 36);

  // Brand button
  ctx.fillStyle = c.buttonBrandBg || c.accent || '#4a6fa5';
  ctx.beginPath(); ctx.roundRect(previewX + previewW - 90, hdrY + 8, 68, 24, 5); ctx.fill();
  ctx.fillStyle = c.buttonBrandText || '#ffffff';
  ctx.font = 'bold 10px Inter, system-ui, sans-serif';
  ctx.fillText('Convert', previewX + previewW - 78, hdrY + 24);

  // Surface card
  var scX = previewX + 18, scY = hdrY + 52;
  var scW = previewW - 36, scH = appH - 110;
  ctx.fillStyle = c.surface || '#ffffff';
  ctx.beginPath(); ctx.roundRect(scX, scY, scW, scH, 6); ctx.fill();
  ctx.strokeStyle = c.border || '#e8e8e6';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Path breadcrumbs
  var pathY2 = scY + 18;
  ['New', 'Working', 'Converted'].forEach(function(label, i) {
    var px = scX + 16 + i * 90;
    ctx.fillStyle = i < 2 ? (c.accent || '#4a6fa5') : (c.surfaceAlt || '#eee');
    ctx.beginPath(); ctx.roundRect(px, pathY2, 82, 22, 11); ctx.fill();
    ctx.fillStyle = i < 2 ? '#ffffff' : (c.textSecondary || '#4a5568');
    ctx.font = '9px Inter, system-ui, sans-serif';
    ctx.fillText(label, px + (i === 2 ? 22 : 26), pathY2 + 14);
  });

  // Tab strip
  var tabY2 = scY + 52;
  ctx.fillStyle = c.tabActiveColor || c.accent || '#4a6fa5';
  ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.fillText('Details', scX + 16, tabY2 + 4);
  ctx.fillRect(scX + 16, tabY2 + 8, 36, 2);
  ctx.fillStyle = c.tabInactiveColor || c.textSecondary || '#4a5568';
  ctx.fillText('Activity', scX + 70, tabY2 + 4);
  ctx.fillText('Chatter', scX + 126, tabY2 + 4);
  ctx.strokeStyle = c.tabNavBorder || c.border || '#e8e8e6';
  ctx.beginPath(); ctx.moveTo(scX, tabY2 + 11); ctx.lineTo(scX + scW, tabY2 + 11); ctx.stroke();

  // Detail rows
  var rows = [['Name', 'John Smith'], ['Email', 'john@example.com'], ['Company', 'Acme Corp'], ['Phone', '+1 (555) 123-4567']];
  rows.forEach(function(row, i) {
    var ry = tabY2 + 28 + i * 28;
    ctx.fillStyle = c.textSecondary || '#64748b';
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.fillText(row[0], scX + 16, ry);
    ctx.fillStyle = row[0] === 'Email' ? (c.link || c.accent || '#4a6fa5') : (c.textPrimary || '#1e293b');
    ctx.fillText(row[1], scX + 120, ry);
    ctx.strokeStyle = c.tableBorderRow || c.border || '#e8e8e6';
    ctx.lineWidth = 0.4;
    ctx.beginPath(); ctx.moveTo(scX + 10, ry + 10); ctx.lineTo(scX + scW - 10, ry + 10); ctx.stroke();
  });

  // Edit/Delete buttons
  var btnRow = tabY2 + 28 + rows.length * 28 + 6;
  ctx.fillStyle = c.buttonNeutralBg || c.surface || '#ffffff';
  ctx.strokeStyle = c.buttonNeutralBorder || c.border || '#c4cdd6';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.roundRect(scX + 16, btnRow, 46, 20, 4); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(scX + 70, btnRow, 52, 20, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.buttonNeutralText || c.textPrimary || '#2d2d2d';
  ctx.font = 'bold 9px Inter, system-ui, sans-serif';
  ctx.fillText('Edit', scX + 30, btnRow + 13);
  ctx.fillText('Delete', scX + 82, btnRow + 13);

  // Toast
  var toastY2 = btnRow + 30;
  if (toastY2 + 24 < scY + scH) {
    ctx.fillStyle = c.success || '#059669';
    ctx.globalAlpha = 0.12;
    ctx.beginPath(); ctx.roundRect(scX + 10, toastY2, scW - 20, 24, 4); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = c.success || '#059669';
    ctx.font = '9px Inter, system-ui, sans-serif';
    ctx.fillText('\u2713 Lead "John Smith" was saved.', scX + 24, toastY2 + 15);
    ctx.fillStyle = c.link || c.accent || '#4a6fa5';
    ctx.font = 'bold 9px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Undo', scX + scW - 20, toastY2 + 15);
    ctx.textAlign = 'left';
  }

  // Bottom bar (footer strip)
  ctx.fillStyle = c.nav || '#4a6fa5';
  ctx.globalAlpha = 0.6;
  ctx.fillRect(previewX, appY + appH - 24, previewW, 24);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.font = '8px Inter, system-ui, sans-serif';
  ctx.globalAlpha = 0.7;
  ctx.fillText('Notes', previewX + 20, appY + appH - 9);
  ctx.fillText('History', previewX + 80, appY + appH - 9);
  ctx.fillText('Open CTI', previewX + 148, appY + appH - 9);
  ctx.globalAlpha = 1;
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

      var canvas = document.createElement('canvas');
      renderShareImage(canvas, theme);
      card.appendChild(canvas);

      var info = document.createElement('div');
      info.className = 'preview-info';

      var name = document.createElement('span');
      name.textContent = theme.name;

      var dl = document.createElement('a');
      dl.textContent = 'Download';
      dl.href = '#';
      (function(c, th) {
        dl.addEventListener('click', function(e) {
          e.preventDefault();
          c.toBlob(function(blob) {
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = th.id + '.png';
            a.click();
            URL.revokeObjectURL(url);
          }, 'image/png');
        });
      })(canvas, theme);

      info.appendChild(name);
      info.appendChild(dl);
      card.appendChild(info);
      grid.appendChild(card);
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
            var cv = cards[idx].querySelector('canvas');
            cv.toBlob(function(blob) {
              var url = URL.createObjectURL(blob);
              var a = document.createElement('a');
              a.href = url;
              a.download = themes[idx].id + '.png';
              a.click();
              URL.revokeObjectURL(url);
            }, 'image/png');
          }, idx * 200);
        })(i);
      }
    });
    status.appendChild(dlAllBtn);
  } catch (err) {
    status.innerHTML = '<div style="color:#ef4444">Error: ' + err.message + '<br><pre style="margin-top:8px;font-size:11px;color:#94a3b8">' + err.stack + '</pre></div>';
  }
});
