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
  var r = size * 0.29;
  var gap = size * 0.5;
  ctx.fillStyle = '#2D2D2D';
  ctx.beginPath(); ctx.arc(cx - gap, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#4A6FA5';
  ctx.lineWidth = size * 0.12;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - gap + r, cy); ctx.lineTo(cx + gap - r, cy); ctx.stroke();
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
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  for (var x = 16; x < W; x += 24) {
    for (var y = 16; y < H; y += 24) {
      ctx.beginPath(); ctx.arc(x, y, 0.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Accent glow blobs
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = c.accent || '#4a6fa5';
  ctx.beginPath(); ctx.arc(0, 0, 200, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(W, H, 180, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  // ─── Top bar: logo + theme name + palette (centered) ───────────
  // Connectry logo
  drawConnectryLogo(ctx, 42, 30, 16);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Salesforce Themer', 62, 34);

  // Theme name — centered
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px Inter, system-ui, sans-serif';
  ctx.fillText(theme.name, W / 2, 34);

  // Color palette dots — right side
  var dotColors = [c.nav, c.accent, c.surface, c.background, c.textPrimary].filter(Boolean);
  var dotR = 8, dotGap = 6;
  var totalDotsW = dotColors.length * dotR * 2 + (dotColors.length - 1) * dotGap;
  var dotsStartX = W - 40 - totalDotsW;
  dotColors.forEach(function(col, i) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(dotsStartX + i * (dotR * 2 + dotGap) + dotR, 30, dotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // ─── Browser preview (centered, fills most of the space) ───────
  var margin = 40;
  var previewW = W - margin * 2;
  var browserBarH = 32;
  var previewY = 56;
  var previewH = H - previewY - 46;

  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 8;

  // Browser chrome bar
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.roundRect(margin, previewY, previewW, browserBarH, [10, 10, 0, 0]);
  ctx.fill();

  // Traffic lights
  ['#ff5f57', '#ffbd2e', '#28c840'].forEach(function(col, i) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(margin + 20 + i * 16, previewY + 16, 4.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Browser tab
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.roundRect(margin + 68, previewY + 6, 160, 20, [5, 5, 0, 0]);
  ctx.fill();
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Salesforce | Leads', margin + 80, previewY + 20);

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // ─── Salesforce app content ────────────────────────────────────
  var appX = margin;
  var appY = previewY + browserBarH;
  var appW = previewW;
  var appH = previewH - browserBarH;

  // Background
  ctx.fillStyle = c.background || '#f7f7f5';
  ctx.beginPath();
  ctx.roundRect(appX, appY, appW, appH, [0, 0, 10, 10]);
  ctx.fill();

  // ── Nav bar ──
  var navH = 40;
  ctx.fillStyle = c.nav || '#4a6fa5';
  ctx.fillRect(appX, appY, appW, navH);

  // App launcher
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (var row = 0; row < 3; row++) {
    for (var col = 0; col < 3; col++) {
      ctx.beginPath();
      ctx.arc(appX + 20 + col * 6, appY + 14 + row * 6, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Search bar
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath(); ctx.roundRect(appX + 46, appY + 9, 200, 22, 11); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.fillText('Search...', appX + 62, appY + 24);

  // Nav items
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px Inter, system-ui, sans-serif';
  var navItems = ['Sales', 'Home', 'Leads', 'Contacts', 'Accounts'];
  navItems.forEach(function(item, i) {
    ctx.fillText(item, appX + 280 + i * 80, appY + 25);
  });

  // Active underline
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(appX + 280 + 2 * 80, appY + navH - 3, 44, 3);

  // User avatar circle (right side of nav)
  ctx.fillStyle = c.accent || '#4a6fa5';
  ctx.beginPath(); ctx.arc(appX + appW - 30, appY + 20, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', appX + appW - 30, appY + 24);
  ctx.textAlign = 'left';

  // Utility icons (right of nav)
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1.2;
  // + icon
  ctx.beginPath(); ctx.moveTo(appX + appW - 100, appY + 15); ctx.lineTo(appX + appW - 100, appY + 25); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(appX + appW - 105, appY + 20); ctx.lineTo(appX + appW - 95, appY + 20); ctx.stroke();

  // ── Page content ──
  var contentY = appY + navH + 8;
  var contentMargin = 28;

  // Page header
  ctx.fillStyle = c.textPrimary || '#2d2d2d';
  ctx.font = 'bold 18px Inter, system-ui, sans-serif';
  ctx.fillText('Lead: John Smith', appX + contentMargin, contentY + 20);

  ctx.fillStyle = c.textSecondary || '#4a5568';
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.fillText('Senior Account Executive', appX + contentMargin, contentY + 38);

  // Action buttons (right side of header)
  // Clone button
  ctx.fillStyle = c.buttonNeutralBg || c.surface || '#ffffff';
  ctx.strokeStyle = c.buttonNeutralBorder || c.border || '#c4cdd6';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(appX + appW - contentMargin - 160, contentY + 6, 68, 26, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.buttonNeutralText || c.textPrimary || '#2d2d2d';
  ctx.font = 'bold 10px Inter, system-ui, sans-serif';
  ctx.fillText('Clone', appX + appW - contentMargin - 140, contentY + 23);

  // Convert button
  ctx.fillStyle = c.buttonBrandBg || c.accent || '#4a6fa5';
  ctx.beginPath(); ctx.roundRect(appX + appW - contentMargin - 82, contentY + 6, 82, 26, 5); ctx.fill();
  ctx.fillStyle = c.buttonBrandText || '#ffffff';
  ctx.fillText('Convert', appX + appW - contentMargin - 60, contentY + 23);

  // ── Main surface card ──
  var cardX = appX + contentMargin;
  var cardY = contentY + 52;
  var cardW = appW - contentMargin * 2;
  var cardH = appH - (contentY - appY) - 52 - 30;

  ctx.fillStyle = c.surface || '#ffffff';
  ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, 8); ctx.fill();
  ctx.strokeStyle = c.border || '#e8e8e6';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // ── Path / Stage ──
  var pathY = cardY + 16;
  var stages = ['New', 'Working', 'Converted'];
  stages.forEach(function(label, i) {
    var px = cardX + 20 + i * 110;
    ctx.fillStyle = i < 2 ? (c.accent || '#4a6fa5') : (c.surfaceAlt || '#eee');
    ctx.beginPath(); ctx.roundRect(px, pathY, 100, 24, 12); ctx.fill();
    ctx.fillStyle = i < 2 ? '#ffffff' : (c.textSecondary || '#4a5568');
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.fillText(label, px + (i === 2 ? 28 : 34), pathY + 16);
  });

  // ── Tab strip ──
  var tabY = pathY + 38;
  ctx.fillStyle = c.tabActiveColor || c.accent || '#4a6fa5';
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.fillText('Details', cardX + 20, tabY + 4);
  ctx.fillRect(cardX + 20, tabY + 9, 40, 2.5);

  ctx.fillStyle = c.tabInactiveColor || c.textSecondary || '#4a5568';
  ctx.fillText('Activity', cardX + 82, tabY + 4);
  ctx.fillText('Chatter', cardX + 148, tabY + 4);

  // Tab border
  ctx.strokeStyle = c.tabNavBorder || c.border || '#e8e8e6';
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(cardX + 8, tabY + 13); ctx.lineTo(cardX + cardW - 8, tabY + 13); ctx.stroke();

  // ── Detail rows ──
  var detailRows = [
    ['Name', 'John Smith'],
    ['Email', 'john@example.com'],
    ['Company', 'Acme Corp'],
    ['Phone', '+1 (555) 123-4567']
  ];
  detailRows.forEach(function(row, i) {
    var ry = tabY + 30 + i * 26;
    ctx.fillStyle = c.textSecondary || '#64748b';
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.fillText(row[0], cardX + 20, ry);
    ctx.fillStyle = row[0] === 'Email' ? (c.link || c.accent || '#4a6fa5') : (c.textPrimary || '#1e293b');
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.fillText(row[1], cardX + 160, ry);
    // Separator
    ctx.strokeStyle = c.tableBorderRow || c.border || '#e8e8e6';
    ctx.lineWidth = 0.4;
    ctx.beginPath(); ctx.moveTo(cardX + 12, ry + 10); ctx.lineTo(cardX + cardW - 12, ry + 10); ctx.stroke();
  });

  // ── Edit / Delete buttons ──
  var btnRowY = tabY + 30 + detailRows.length * 26 + 8;
  ctx.fillStyle = c.buttonNeutralBg || c.surface || '#ffffff';
  ctx.strokeStyle = c.buttonNeutralBorder || c.border || '#c4cdd6';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.roundRect(cardX + 20, btnRowY, 50, 22, 4); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(cardX + 78, btnRowY, 58, 22, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.buttonNeutralText || c.textPrimary || '#2d2d2d';
  ctx.font = 'bold 9px Inter, system-ui, sans-serif';
  ctx.fillText('Edit', cardX + 36, btnRowY + 14);
  ctx.fillText('Delete', cardX + 94, btnRowY + 14);

  // ── Toast ──
  var toastY = btnRowY + 32;
  if (toastY + 22 < cardY + cardH - 4) {
    ctx.fillStyle = c.success || '#059669';
    ctx.globalAlpha = 0.1;
    ctx.beginPath(); ctx.roundRect(cardX + 12, toastY, cardW - 24, 22, 4); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = c.success || '#059669';
    ctx.font = '9px Inter, system-ui, sans-serif';
    ctx.fillText('\u2713 Lead "John Smith" was saved.', cardX + 28, toastY + 14);
    ctx.fillStyle = c.link || c.accent || '#4a6fa5';
    ctx.font = 'bold 9px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Undo', cardX + cardW - 24, toastY + 14);
    ctx.textAlign = 'left';
  }

  // ── Footer utility bar ──
  var footerY = appY + appH - 24;
  ctx.fillStyle = c.nav || '#4a6fa5';
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.roundRect(appX, footerY, appW, 24, [0, 0, 10, 10]);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.font = '8px Inter, system-ui, sans-serif';
  ctx.globalAlpha = 0.7;
  ctx.fillText('\u2261 Notes', appX + 20, footerY + 15);
  ctx.fillText('\u25cb History', appX + 90, footerY + 15);
  ctx.fillText('\u25a1 Open CTI', appX + 170, footerY + 15);
  ctx.globalAlpha = 1;

  // ─── Bottom bar: logo + tagline + theme name (centered) ────────
  var bottomY = H - 32;
  ctx.textAlign = 'center';

  // Connectry logo centered
  drawConnectryLogo(ctx, W / 2 - 100, bottomY, 12);

  // "Salesforce Themer" next to logo
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 13px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Salesforce Themer', W / 2 - 84, bottomY + 4);

  // Separator dot
  ctx.fillStyle = '#475569';
  ctx.font = '13px Inter, system-ui, sans-serif';
  ctx.fillText('\u00b7', W / 2 + 28, bottomY + 4);

  // "Built with care by Connectry"
  ctx.fillStyle = '#64748b';
  ctx.font = '12px Inter, system-ui, sans-serif';
  ctx.fillText('Built with care by Connectry', W / 2 + 40, bottomY + 4);
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
      })(cvs, theme);

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
