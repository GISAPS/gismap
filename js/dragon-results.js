// Client-side, unsigned legends. A link is a keepsake, not proof of a score.
(() => {
  'use strict';
  const MAX_NAME = 32, MAX_SCORE = 1000000;
  const cleanName = (value) => Array.from(String(value || '').replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim()).slice(0, MAX_NAME).join('');
  const validNumber = (value) => /^\d{1,7}$/.test(value || '') && Number(value) <= MAX_SCORE;
  const beats = (result, target) => Boolean(target && (result.score > target.score || (result.score === target.score && result.distance > target.distance)));
  const parse = (href) => {
    try {
      const p = new URL(href).searchParams;
      if (p.get('legend') !== '1' || !validNumber(p.get('maidens')) || !validNumber(p.get('distance'))) return null;
      const name = cleanName(p.get('name'));
      if (!name) return null;
      const result = { name, score: Number(p.get('maidens')), distance: Number(p.get('distance')) };
      if (cleanName(p.get('challenger')) && validNumber(p.get('challengerMaidens')) && validNumber(p.get('challengerDistance'))) {
        result.challenge = { name: cleanName(p.get('challenger')), score: Number(p.get('challengerMaidens')), distance: Number(p.get('challengerDistance')) };
      }
      if (cleanName(p.get('beaten')) && validNumber(p.get('beatenMaidens')) && validNumber(p.get('beatenDistance'))) {
        const target = { name: cleanName(p.get('beaten')), score: Number(p.get('beatenMaidens')), distance: Number(p.get('beatenDistance')) };
        if (beats(result, target)) result.beaten = target;
      }
      return result;
    } catch { return null; }
  };
  const linkFor = (origin, result) => {
    const url = new URL('/dragons/', origin);
    const params = new URLSearchParams({ legend: '1', name: cleanName(result.name), maidens: String(result.score), distance: String(result.distance) });
    if (result.challenge) {
      params.set('challenger', cleanName(result.challenge.name));
      params.set('challengerMaidens', String(result.challenge.score));
      params.set('challengerDistance', String(result.challenge.distance));
    } else if (result.beaten && beats(result, result.beaten)) {
      params.set('beaten', cleanName(result.beaten.name));
      params.set('beatenMaidens', String(result.beaten.score));
      params.set('beatenDistance', String(result.beaten.distance));
    }
    url.search = params;
    return url.href;
  };
  const challengeOutcome = (result, target) => {
    if (!target) return null;
    const comparable = { score: result.score, distance: Math.floor(result.distance) };
    return beats(comparable, target) ? 'win' : beats(target, comparable) ? 'loss' : 'tie';
  };
  const storyFor = ({ name, score, distance, beaten, challenge }) => {
    const dragon = cleanName(name) || 'THE NAMELESS DRAGON';
    const target = challenge || beaten;
    const outcome = challengeOutcome({ score, distance }, target);
    let contest = '';
    if (target && outcome) {
      const opponent = cleanName(target.name).toUpperCase();
      const comparison = outcome === 'win' ? `SURPASSED THE LEGEND OF ${opponent}` : outcome === 'loss' ? `FELL SHORT OF THE LEGEND OF ${opponent}` : `MATCHED THE LEGEND OF ${opponent}`;
      contest = `\n\nAND LO! ${dragon.toUpperCase()} ${comparison}, WHOSE SCORE WAS ${target.score} MAIDENS AND ${target.distance} LEAGUES. THE ROYAL SCOREKEEPER DROPPED HIS QUILL.`;
    }
    return `HEAR YE, HEAR YE!\n\nWE, THE BRAVE KNIGHTS OF THE REALM, FINALLY SLEW ${dragon.toUpperCase()}!\n\nTHE BEAST CROSSED ${distance} LEAGUES, OUTWITTING SERPENTS, KRAKENS, AND AN ALARMING NUMBER OF LANCES.\n\nWE LOST ${score} ${score === 1 ? 'MAIDEN' : 'MAIDENS'} TO THE BEAST. WE SHALL BE DISCUSSING THIS WITH THE CASTLE GUARDS.${contest}\n\nAT LAST WE TRIUMPHED! (THE DRAGON MAY ALSO HAVE HIT THE GROUND.)\n\nTHUS ENDS THE LEGEND. INSERT ANOTHER ADVENTURE?`;
  };
  const story = document.querySelector('#legendStory'), scroll = document.querySelector('#legendScroll'), scoreText = document.querySelector('#legendScore'), shareButton = document.querySelector('#shareResults');
  const dialog = document.querySelector('#shareDialog'), close = document.querySelector('#shareClose');
  const qr = document.querySelector('#shareQr'), status = document.querySelector('#shareStatus'), copy = document.querySelector('#copyLink'), download = document.querySelector('#downloadQr'), mobileShare = document.querySelector('#mobileShare'), copyFallback = document.querySelector('#copyFallback'), copyFallbackLabel = document.querySelector('#copyFallbackLabel'), brand = document.querySelector('.logo img');
  const recordDialog = document.querySelector('#recordDialog'), recordForm = document.querySelector('#recordForm'), recordName = document.querySelector('#recordName'), recordScore = document.querySelector('#recordScore'), recordOutcome = document.querySelector('#recordOutcome'), recordFlyAgain = document.querySelector('#recordFlyAgain');
  let current = null, pendingRecord = null, shareUrl = '', shareImage = null, shareGeneration = 0;
  function record(result, onComplete, onRetry) {
    pendingRecord = { result, onComplete, onRetry };
    recordName.value = '';
    recordName.setCustomValidity('');
    const outcome = challengeOutcome(result, result.challenge);
    recordOutcome.hidden = !outcome;
    recordOutcome.textContent = outcome ? `You have ${outcome === 'win' ? 'defeated' : outcome === 'loss' ? 'been defeated by' : 'tied with'} ${cleanName(result.challenge.name)}.` : '';
    recordScore.textContent = `Maidens ${result.score} · Distance ${Math.floor(result.distance)} leagues`;
    recordDialog.showModal();
    recordName.focus();
  }
  recordForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!pendingRecord) return;
    const name = cleanName(recordName.value);
    if (!name) { recordName.setCustomValidity('Enter a dragon name.'); recordName.reportValidity(); return; }
    recordName.setCustomValidity('');
    const { result, onComplete } = pendingRecord;
    pendingRecord = null;
    recordDialog.close();
    onComplete({ ...result, name });
  });
  recordFlyAgain.addEventListener('click', () => {
    if (!pendingRecord) return;
    const { onRetry } = pendingRecord;
    pendingRecord = null;
    recordDialog.close();
    onRetry();
  });
  recordName.addEventListener('input', () => recordName.setCustomValidity(''));
  // Keep the game-over flow reachable even when the browser sends Escape.
  recordDialog.addEventListener('cancel', (event) => event.preventDefault());
  const challengeMessage = (target) => `The famous dragon ${cleanName(target.name)} has taken ${target.score} ${target.score === 1 ? 'maiden' : 'maidens'} and flown ${target.distance} ${target.distance === 1 ? 'league' : 'leagues'} — can you beat ${cleanName(target.name)}?`;
  function show(result) {
    current = { name: cleanName(result.name), score: Math.max(0, Math.min(MAX_SCORE, Math.floor(result.score))), distance: Math.max(0, Math.min(MAX_SCORE, Math.floor(result.distance))), beaten: result.beaten || null, challenge: result.challenge || null };
    story.textContent = storyFor(current); scoreText.textContent = `MAIDENS ${current.score} · DISTANCE ${current.distance} LEAGUES`;
    scroll.hidden = false; scoreText.hidden = false; shareButton.hidden = false;
  }
  function hide() { scroll.hidden = true; scoreText.hidden = true; shareButton.hidden = true; }
  // Draw the QR into its own undisturbed white square. The illustration and
  // border stay outside its four-module quiet zone so scanners can read it.
  function decorateQr(source, canvas) {
    canvas.width = 600; canvas.height = 760;
    const c = canvas.getContext('2d');
    c.fillStyle = '#125848'; c.fillRect(0, 0, 600, 760);
    c.fillStyle = '#fffaf0'; c.fillRect(16, 16, 568, 728);
    c.fillStyle = '#125848'; c.fillRect(16, 16, 568, 118);
    c.strokeStyle = '#2e8068'; c.lineWidth = 3; c.strokeRect(25, 25, 550, 710);
    if (brand?.complete && brand.naturalWidth) c.drawImage(brand, 42, 30, 86, 86);
    c.textAlign = 'left'; c.fillStyle = '#ffffff'; c.font = 'bold 31px Arial, sans-serif'; c.fillText('GISMap Online', 146, 72);
    c.fillStyle = '#f6d478'; c.font = 'bold 16px monospace'; c.fillText('HERE BE DRAGONS', 146, 101);
    const opponent = current.challenge || current.beaten;
    if (opponent) {
      const outcome = challengeOutcome(current, opponent);
      const label = outcome === 'win' ? 'DEFEATED' : outcome === 'loss' ? 'OUTMATCHED BY' : 'TIED WITH';
      c.textAlign = 'center'; c.fillStyle = '#245245'; c.font = 'bold 13px monospace';
      c.fillText(`${label} ${cleanName(opponent.name).toUpperCase()}`, 300, 149, 530);
    }
    c.fillStyle = '#fff4c6'; c.fillRect(76, 156, 448, 448);
    c.imageSmoothingEnabled = false; c.drawImage(source, 80, 160, 440, 440);
    // Reuse the same artwork as the game, scaled to fit below the QR quiet zone.
    if (globalThis.DragonArt) {
      c.save(); c.translate(145, 690); c.scale(.45, .45);
      globalThis.DragonArt.drawDragon(c, { x: 0, y: 0, vy: 0, flap: 1, invuln: 0 }, 0);
      c.restore();
    }
    c.fillStyle = '#245245'; c.font = 'bold 18px monospace'; c.textAlign = 'center'; c.fillText('MIGHT YOU BEST MY BEST?', 380, 691);
    c.fillStyle = '#a27a3f'; c.font = '14px Georgia, serif'; c.fillText('gismap.online/dragons', 300, 721);
  }
  async function makeShareCard(generation) {
    try {
      if (!globalThis.QRCode?.toCanvas) throw new Error('QR code generator unavailable');
      const plain = document.createElement('canvas');
      await globalThis.QRCode.toCanvas(plain, shareUrl, { width: 440, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#123f36', light: '#fff4c6' } });
      if (brand?.decode) await brand.decode().catch(() => {});
      if (generation !== shareGeneration) return;
      decorateQr(plain, qr);
      qr.hidden = false; download.href = qr.toDataURL('image/png'); download.hidden = false;
      if (qr.toBlob && typeof File !== 'undefined') qr.toBlob((blob) => {
        if (blob && generation === shareGeneration) shareImage = new File([blob], 'here-be-dragons.png', {type: 'image/png'});
      }, 'image/png');
    } catch { if (generation === shareGeneration) { qr.hidden = true; status.textContent = 'QR code unavailable; you can still share or copy the link.'; } }
  }
  shareButton.addEventListener('click', async () => {
    if (!current) return;
    shareUrl = linkFor('https://gismap.online', current); shareImage = null;
    qr.hidden = true; download.hidden = true; copyFallback.hidden = true; copyFallbackLabel.hidden = true; status.textContent = '';
    dialog.showModal();
    await makeShareCard(++shareGeneration);
  });
  close.addEventListener('click', () => { shareGeneration++; dialog.close(); });
  async function copyShareLink() {
    try { await navigator.clipboard.writeText(shareUrl); status.textContent = 'Link copied.'; }
    catch { copyFallback.value = shareUrl; copyFallback.hidden = false; copyFallbackLabel.hidden = false; copyFallback.focus(); copyFallback.select(); status.textContent = 'Copy the selected link manually.'; }
  }
  copy.addEventListener('click', copyShareLink);
  mobileShare.addEventListener('click', async () => {
    if (!navigator.share) { await copyShareLink(); return; }
    const share = { title: 'Here be dragons | GISMap Online', text: challengeMessage(current), url: shareUrl };
    if (shareImage && navigator.canShare?.({ ...share, files: [shareImage] })) share.files = [shareImage];
    try { await navigator.share(share); }
    catch (error) { if (error?.name !== 'AbortError') status.textContent = 'Could not open sharing. Try Copy link instead.'; }
  });
  globalThis.DragonResults = { parse, linkFor, storyFor, beats, challengeMessage, record, show, hide };
})();
