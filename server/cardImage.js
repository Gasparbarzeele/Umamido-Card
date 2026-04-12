// server/cardImage.js — SVG card image (no native deps)
const STAMPS_FOR_REWARD = 10;
const NAVY = '#1a1e5a';
const ORANGE = '#e8461e';

function generateCardSVG(stamps = 0) {
  const W = 1032, H = 336;
  const stampR = 30;
  const stampGap = 12;
  const cols = 5;
  const startX = 280;
  const totalStampW = cols * (stampR * 2) + (cols - 1) * stampGap;
  const sy = 28;

  let stampsHTML = '';
  for (let i = 0; i < STAMPS_FOR_REWARD; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = startX + col * (stampR * 2 + stampGap) + stampR;
    const cy = sy + row * (stampR * 2 + stampGap + 8) + stampR;
    const filled = i < stamps;
    if (filled) {
      stampsHTML += `
        <circle cx="${cx}" cy="${cy}" r="${stampR-2}" fill="none" stroke="${ORANGE}" stroke-width="2.5" stroke-dasharray="10 4"/>
        <circle cx="${cx}" cy="${cy}" r="${Math.round(stampR*0.68)}" fill="rgba(232,70,30,0.08)" stroke="${ORANGE}" stroke-width="1.5" stroke-dasharray="7 4"/>
        <text x="${cx}" y="${cy+3}" text-anchor="middle" dominant-baseline="middle" font-family="serif" font-size="${Math.round(stampR*1.1)}" font-weight="900" fill="${ORANGE}">飲</text>`;
    } else {
      stampsHTML += `<circle cx="${cx}" cy="${cy}" r="${stampR-2}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" stroke-dasharray="8 5"/>`;
    }
  }

  const barY = sy + 2*(stampR*2+stampGap+8)+12;
  const barW = totalStampW;
  const barX = startX;
  const fillW = Math.round(barW * stamps / STAMPS_FOR_REWARD);
  const remaining = STAMPS_FOR_REWARD - stamps;
  const rewardText = stamps >= STAMPS_FOR_REWARD
    ? 'RAMEN OFFERT — Montre ta carte !'
    : `Encore ${remaining} tampon${remaining>1?'s':''} pour ton ramen offert`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="dots" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
      <circle cx="8" cy="8" r="1.5" fill="rgba(232,70,30,0.12)"/>
    </pattern>
    <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${ORANGE}"/><stop offset="100%" stop-color="#ff9060"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${NAVY}"/>
  <rect width="${W}" height="${H}" fill="url(#dots)"/>
  <circle cx="125" cy="${H/2}" r="115" fill="rgba(232,70,30,0.05)"/>
  <text x="125" y="${H/2+8}" text-anchor="middle" dominant-baseline="middle" font-size="120">🦊</text>
  ${stampsHTML}
  <rect x="${barX}" y="${barY}" width="${barW}" height="4" rx="2" fill="rgba(255,255,255,0.1)"/>
  ${fillW>0?`<rect x="${barX}" y="${barY}" width="${fillW}" height="4" rx="2" fill="url(#barGrad)"/>`:''}
  <text x="${barX}" y="${barY+24}" font-family="Arial,sans-serif" font-size="20" font-weight="bold" fill="${ORANGE}" letter-spacing="2">${stamps} / ${STAMPS_FOR_REWARD}</text>
  <text x="${barX+90}" y="${barY+24}" font-family="Arial,sans-serif" font-size="${stamps>=STAMPS_FOR_REWARD?18:15}" fill="${stamps>=STAMPS_FOR_REWARD?'#ffffff':'rgba(180,185,220,0.9)'}">${rewardText}</text>
  <text x="${W-16}" y="${H-12}" text-anchor="end" font-family="Arial,sans-serif" font-size="15" fill="${ORANGE}">No Stain, No Gain !!</text>
</svg>`;
}

module.exports = { generateCardSVG };
