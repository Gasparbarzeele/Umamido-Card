// server/cardImage.js — Génération d'image dynamique pour Google Wallet
// Requires: npm install canvas

const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const fs = require('fs');

const FONTS_DIR = path.resolve('./fonts');
const FOX_PATH = path.resolve('./public/images/logo.png');

// Register Bebas Neue if available
function registerFonts() {
  const bebasPath = path.join(FONTS_DIR, 'BebasNeue-Regular.ttf');
  if (fs.existsSync(bebasPath)) {
    registerFont(bebasPath, { family: 'BebasNeue' });
  }
}

try { registerFonts(); } catch(e) {}

const W = 1032;
const H = 336;
const NAVY  = '#1a1e5a';
const ORANGE = '#e8461e';
const WHITE  = '#ffffff';
const STAMPS = 10;

function drawHankoStamp(ctx, cx, cy, r, filled) {
  ctx.save();

  if (filled) {
    // Outer dashed circle
    ctx.beginPath();
    ctx.setLineDash([8, 4]);
    ctx.strokeStyle = ORANGE;
    ctx.lineWidth = 3;
    ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
    ctx.stroke();

    // Inner circle
    ctx.beginPath();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = ORANGE;
    ctx.lineWidth = 1.5;
    ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Subtle fill
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(232,70,30,0.08)';
    ctx.fill();

    // 飲 kanji
    ctx.font = `${Math.floor(r * 1.1)}px serif`;
    ctx.fillStyle = ORANGE;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('飲', cx, cy + 2);

  } else {
    // Empty dashed circle
    ctx.beginPath();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

async function generateCardImage(stamps = 0) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, H);

  // Halftone dots
  for (let x = 0; x < W; x += 16) {
    for (let y = 0; y < H; y += 16) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(232,70,30,0.12)';
      ctx.fill();
    }
  }

  // Fox logo
  try {
    const fox = await loadImage(FOX_PATH);
    const foxH = 290;
    const foxW = Math.round(foxH * fox.width / fox.height);
    ctx.drawImage(fox, 16, Math.round((H - foxH) / 2), foxW, foxH);

    // Stamps grid
    const stampR = 34;
    const stampGap = 14;
    const cols = 5;
    const totalW = cols * (stampR * 2) + (cols - 1) * stampGap;
    const startX = foxW + 40 + Math.round((W - foxW - 40 - totalW) / 2) + stampR;
    const startY = 30 + stampR;

    for (let i = 0; i < STAMPS; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = startX + col * (stampR * 2 + stampGap);
      const cy = startY + row * (stampR * 2 + stampGap + 8);
      drawHankoStamp(ctx, cx, cy, stampR, i < stamps);
    }

    // Progress bar
    const barY = startY + 2 * (stampR * 2 + stampGap + 8) + 10;
    const barW = totalW;
    const barH = 4;
    const barX = startX - stampR;

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 2);
    ctx.fill();

    if (stamps > 0) {
      const fillW = Math.round(barW * stamps / STAMPS);
      const grad = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
      grad.addColorStop(0, ORANGE);
      grad.addColorStop(1, '#ff9060');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(barX, barY, fillW, barH, 2);
      ctx.fill();
    }

    // Progress text
    const textY = barY + barH + 14;
    ctx.font = "bold 22px 'BebasNeue', 'DejaVu Sans', sans-serif";
    ctx.fillStyle = ORANGE;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.letterSpacing = '3px';
    ctx.fillText(`${stamps} / ${STAMPS}`, barX, textY);

    // Reward text
    ctx.font = "bold 20px 'BebasNeue', 'DejaVu Sans', sans-serif";
    if (stamps >= STAMPS) {
      ctx.fillStyle = WHITE;
      ctx.fillText('— 🍜 RAMEN OFFERT ! Montre ta carte en caisse', barX + 80, textY);
    } else {
      const remaining = STAMPS - stamps;
      ctx.fillStyle = 'rgba(180,185,220,0.9)';
      ctx.fillText(`— encore ${remaining} tampon${remaining > 1 ? 's' : ''} pour ton ramen offert`, barX + 80, textY);
    }

    // Slogan bottom right
    ctx.font = "16px 'DejaVu Sans', sans-serif";
    ctx.fillStyle = ORANGE;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('No Stain, No Gain !!', W - 16, H - 12);

  } catch (err) {
    console.error('Image generation error:', err.message);
    // Fallback: just navy background
  }

  return canvas.toBuffer('image/png');
}

module.exports = { generateCardImage };
