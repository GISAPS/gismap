import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const code = await readFile(new URL('../js/dragon-results.js', import.meta.url), 'utf8');
function setup({nativeShare = true, clipboard = true} = {}) {
  const listeners = new Map();
  const make = (id) => ({ id, value:'', textContent:'', hidden:false, href:'', focus(){}, select(){}, showModal(){}, close(){}, setCustomValidity(){}, reportValidity(){}, addEventListener(type, fn){listeners.set(`${id}:${type}`,fn)} });
  const nodes = Object.fromEntries(['legendStory','legendScroll','legendScore','shareResults','shareDialog','shareClose','shareQr','shareStatus','copyLink','challengeBanner','downloadQr','recordDialog','recordForm','recordName','recordScore','recordOutcome','recordFlyAgain','mobileShare','copyFallback','copyFallbackLabel'].map(id=>[id,make(id)]));
  let encoded = '', copied = '', shared = null, dragonDrawn = false;
  const draws = [], labels = [];
  const ctx = new Proxy({}, { get: (_target, key) => (...args) => { if (key === 'drawImage') draws.push(args); if (key === 'fillText') labels.push(args[0]); }, set: () => true });
  nodes.shareQr.getContext = () => ctx;
  nodes.shareQr.toDataURL = () => 'data:image/png;base64,example';
  const context = { document:{querySelector: selector=>nodes[selector.slice(1)], createElement: () => ({})}, location:{origin:'https://gismap.online'}, navigator:{clipboard:{writeText:async url=>{if (!clipboard) throw new Error('unavailable'); copied=url}},share:nativeShare ? async data=>{shared=data} : undefined}, URL, URLSearchParams, Math, Array, String, Number, DragonArt:{drawDragon:()=>{dragonDrawn=true}}, QRCode:{toCanvas:async (_canvas, url)=>{encoded=url}} };
  runInNewContext(code, context);
  return { api:context.DragonResults, nodes, listeners, getEncoded:()=>encoded, getCopied:()=>copied, getShared:()=>shared, getDragonDrawn:()=>dragonDrawn, draws, labels };
}
test('share links preserve name and score and reject malformed results', () => {
  const {api} = setup();
  const href = api.linkFor('https://gismap.online', {name:'Sir Flaps & <friends>',score:6,distance:507});
  const result = api.parse(href);
  assert.equal(result.name, 'Sir Flaps & <friends>');
  assert.equal(result.score, 6);
  assert.equal(result.distance, 507);
  for (const bad of ['?legend=1&name=A&maidens=-1&distance=2','?legend=1&name=A&maidens=1&distance=9999999','?legend=1&name=&maidens=1&distance=2','?legend=1&name=A&maidens=NaN&distance=2']) assert.equal(api.parse('https://gismap.online/dragons/'+bad), null);
});
test('sharing uses the recorded name immediately and generates a canonical challenge URL', async () => {
  const {api,nodes,listeners,getEncoded,getCopied,getShared} = setup();
  api.show({name:'<dragon> & friends',score:1,distance:42});
  assert.match(nodes.legendStory.textContent, /WE LOST 1 MAIDEN TO THE BEAST/);
  await listeners.get('shareResults:click')();
  const url = getEncoded();
  assert.equal(new URL(url).origin, 'https://gismap.online');
  assert.equal(new URL(url).pathname, '/dragons/');
  assert.equal(api.parse(url).name, '<dragon> & friends');
  await listeners.get('copyLink:click')();
  assert.equal(getCopied(), url);
  await listeners.get('mobileShare:click')();
  assert.equal(getShared().url, url);
  assert.match(getShared().text, /<dragon> & friends/);
});


test('challenge compares maidens first and distance breaks ties', () => {
  const { api } = setup();
  const target = {name:'Old Wyrm', score:3, distance:100};
  assert.equal(api.beats({score:4,distance:0},target), true);
  assert.equal(api.beats({score:2,distance:999},target), false);
  assert.equal(api.beats({score:3,distance:101},target), true);
  assert.equal(api.beats({score:3,distance:100},target), false);
  assert.match(api.challengeMessage(target),/The famous dragon Old Wyrm has taken 3 maidens and flown 100 leagues — can you beat Old Wyrm\?/);
});

test('winning challenge survives sharing and appears in the legend, but ties do not', () => {
  const { api } = setup();
  const target = {name:'Old Wyrm',score:3,distance:100};
  const winner = {name:'New Wyrm',score:3,distance:101,beaten:target};
  const restored = api.parse(api.linkFor('https://gismap.online',winner));
  assert.equal(restored.beaten.name, 'Old Wyrm');
  assert.match(api.storyFor(restored),/SURPASSED THE LEGEND OF OLD WYRM/);
  const tie = {...winner,distance:100};
  assert.equal(api.parse(api.linkFor('https://gismap.online',tie)).beaten, undefined);
  assert.doesNotMatch(api.storyFor(tie),/SURPASSED THE LEGEND/);
  assert.equal(api.parse('https://gismap.online/dragons/?legend=1&name=A&maidens=1&distance=2&beaten=B&beatenMaidens=9&beatenDistance=0').beaten, undefined);
});

test('share generates a decorated downloadable QR without drawing over its quiet zone', async () => {
  const { api,nodes,listeners,draws,getDragonDrawn,labels } = setup();
  api.show({name:'Flap',score:5,distance:123});
  await listeners.get('shareResults:click')();
  assert.equal(nodes.shareQr.width,600);
  assert.equal(nodes.shareQr.height,760);
  assert.equal(nodes.downloadQr.hidden,false);
  assert.match(nodes.downloadQr.href,/^data:image\/png/);
  assert.ok(labels.includes('GISMap Online'));
  assert.equal(getDragonDrawn(),true);
  assert.equal(draws.length,1);
  assert.deepEqual(draws[0].slice(1),[80,160,440,440]);
});


test('record score asks for a name before showing the story', () => {
  const {api,nodes,listeners} = setup();
  let result;
  api.record({score:2,distance:42.8,beaten:null}, value => {result = value; api.show(value)});
  assert.equal(nodes.recordScore.textContent, 'Maidens 2 · Distance 42 leagues');
  nodes.recordName.value = '  ';
  listeners.get('recordForm:submit')({preventDefault(){}});
  assert.equal(result, undefined);
  nodes.recordName.value = 'Sir Flaps';
  listeners.get('recordForm:submit')({preventDefault(){}});
  assert.equal(result.name, 'Sir Flaps');
  assert.match(nodes.legendStory.textContent, /SLEW SIR FLAPS/);
  assert.match(nodes.legendStory.textContent, /WE LOST 2 MAIDENS/);
  assert.equal(nodes.legendScore.textContent, 'MAIDENS 2 · DISTANCE 42 LEAGUES');
});


test('mobile sharing falls back to copy and offers manual copy if clipboard is unavailable', async () => {
  const first = setup({nativeShare:false});
  first.api.show({name:'Flap',score:2,distance:50});
  await first.listeners.get('shareResults:click')();
  await first.listeners.get('mobileShare:click')();
  assert.equal(first.getCopied(), first.getEncoded());
  assert.equal(first.nodes.shareStatus.textContent, 'Link copied.');

  const second = setup({nativeShare:false,clipboard:false});
  second.api.show({name:'Flap',score:2,distance:50});
  await second.listeners.get('shareResults:click')();
  await second.listeners.get('mobileShare:click')();
  assert.equal(second.nodes.copyFallback.hidden, false);
  assert.equal(second.nodes.copyFallback.value, second.getEncoded());
});


test('fly again skips recording even without a name', () => {
  const {api,nodes,listeners} = setup();
  let retried = 0, recorded = 0;
  api.record({score:1,distance:20}, () => recorded++, () => retried++);
  nodes.recordName.value = '';
  listeners.get('recordFlyAgain:click')();
  assert.equal(retried, 1);
  assert.equal(recorded, 0);
  listeners.get('recordForm:submit')({preventDefault(){}});
  assert.equal(recorded, 0);
});


test('challenge outcomes are announced and preserved in shared legends and QR cards', async () => {
  const target = {name:'<Old Wyrm>',score:3,distance:100};
  for (const [score, distance, message, story, card] of [
    [4, 0, 'You have defeated <Old Wyrm>.', /SURPASSED THE LEGEND OF <OLD WYRM>/, 'DEFEATED <OLD WYRM>'],
    [2, 999, 'You have been defeated by <Old Wyrm>.', /FELL SHORT OF THE LEGEND OF <OLD WYRM>/, 'OUTMATCHED BY <OLD WYRM>'],
    [3, 100.9, 'You have tied with <Old Wyrm>.', /MATCHED THE LEGEND OF <OLD WYRM>/, 'TIED WITH <OLD WYRM>'],
  ]) {
    const {api,nodes,listeners,getEncoded,labels} = setup();
    let recorded;
    api.record({score,distance,challenge:target}, value => { recorded = value; api.show(value); });
    assert.equal(nodes.recordOutcome.hidden, false);
    assert.equal(nodes.recordOutcome.textContent, message);
    nodes.recordName.value = 'New Wyrm';
    listeners.get('recordForm:submit')({preventDefault(){}});
    assert.match(nodes.legendStory.textContent, story);
    assert.equal(recorded.challenge.name, target.name);
    await listeners.get('shareResults:click')();
    assert.ok(labels.includes(card));
    const restored = api.parse(getEncoded());
    assert.equal(restored.challenge.name, target.name);
    assert.match(api.storyFor(restored), story);
  }
  const {api,nodes} = setup();
  api.record({score:0,distance:0}, () => {});
  assert.equal(nodes.recordOutcome.hidden, true);
});

test('malformed challenger data is ignored and older winning links stay readable', () => {
  const {api} = setup();
  const malformed = api.parse('https://gismap.online/dragons/?legend=1&name=A&maidens=1&distance=2&challenger=B&challengerMaidens=-1&challengerDistance=1');
  assert.equal(malformed.challenge, undefined);
  const old = api.parse('https://gismap.online/dragons/?legend=1&name=A&maidens=2&distance=2&beaten=B&beatenMaidens=1&beatenDistance=1');
  assert.match(api.storyFor(old), /SURPASSED THE LEGEND OF B/);
});
