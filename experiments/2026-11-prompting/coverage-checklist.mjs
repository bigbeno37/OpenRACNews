// Pre-registered scoring for 1 November, written before any prompt variant ran. Each check is a fact the
// day's snapshot supports and a reader would want. Coverage only: accuracy and readability go to blind judges.
import { existsSync, readFileSync } from 'node:fs';

const CHECKS = {
  'OpenRAC__develop': [
    ['mod index and auto-update', /auto-?updat|automatic(ally)? updat|updates? automatically/i],
    ['warns #161 is untested on some platforms', /(not|n't)[^.]{0,24}(run|tested)|untested/i],
    ['Windows sound gaps fixed', /sound|audio/i],
    ['Vulkan becomes the default', /vulkan[^.]{0,60}default|default[^.]{0,60}vulkan/i],
    ['Enhanced graphics faster on phones', /phone/i],
    ['draft port is not playable yet', /(not|n't)[^.]{0,30}playable|unplayable/i],
    ['explains the line count with #160', /#160/],
    ['diagonal movement fix', /diagonal/i],
  ],
  'OpenRAC__master': [
    ['says this was not a release', /(rather than|not|n't|outside|without|instead of|no )[^.]{0,40}release/i],
    ['names PAL level 11', /level 11/i],
    ['reports the 254 regions result', /254/],
    ['links issue #173', /#173/],
  ],
  'openrac-mods__master': [
    ['Archipelago 2.1.0 release', /2\.1\.0/],
    ['item randomizer 1.0.4 release', /1\.0\.4/],
    ['difficulty 1.2.4 release', /1\.2\.4/],
    ['play-test request in #25', /#25|play-?test/i],
    ['Blarg Station fix', /Blarg/],
    ['AI assistance listing', /\bAI\b/],
    ['save slots and seeds', /seed|save slot|memory card/i],
  ],
  'rac1-decomp__main': [
    ['says nothing changes for players', /(nothing|no change|not change|n't change|unchanged)[^.]{0,50}player|player[^.]{0,60}(nothing|no change|unchanged|n't|not)/i],
    ['all 5116 functions still match', /5,?116/],
    ['compiled data reaches 74%', /74%/],
    ['explains the line count with #169', /#169/],
    ['names replaced numbers', /hero state|HERO_STATE|PAD_|button/i],
    ['45 pull requests', /\b45\b|forty-five/i],
  ],
  'rac2-decomp__master': [
    ['says 7760 is USA v1.01', /USA v1\.01/],
    ['gives a USA v2.00 figure', /v2\.00[^.]{0,60}\d/],
    ['gives a PAL or Europe figure', /(PAL|Europe)[^.]{0,60}\d/],
    ['gives the code percentage', /84\.7|84\.6/],
    ['the largest batch, #386', /#386/],
    ['453 functions in #384', /453/],
    ['draft #389 adds no matches', /#389/],
  ],
  'rac4-decomp__main': [
    ['how many pull requests merged', /\b(18|20|eighteen|twenty)\b/i],
    ['the 30 function batch, #54', /#54/],
    ['the 53 functions waiting, #78', /#78[^.]{0,60}53|53[^.]{0,60}#78/],
    ['disc image tooling, #56', /#56/],
    ['gives the code percentage', /6\.07|6\.1%/],
    ['PAL release named', /PAL/],
  ],
  overview: [
    ['cites at least three items as repo#N', (text) => (text.match(/[\w-]+#\d+/g) ?? []).length >= 3],
    ['says 7760 is USA v1.01', /USA v1\.01/],
    ['mentions the native port draft', /native port|port of Going/i],
    ['mentions SDK 1.11.0', /1\.11/],
    ['covers Ratchet & Clank cleanup', /Ratchet & Clank/],
    ['covers Deadlocked', /Deadlocked/],
    ['covers the mods', /Archipelago|mods?\b/i],
    ['covers the stable line', /stable/i],
  ],
};

const sentences = (s) => (s.replace(/\b(v\d+(\.\d+)*|\d+\.\d+)/g, 'X').match(/[.!?](\s|$)/g) ?? []).length;
const words = (s) => s.trim().split(/\s+/).length;

export function score(root) {
  const items = {};
  let hit = 0, total = 0, overLimit = 0, wordCount = 0, missing = 0;
  for (const [name, checks] of Object.entries(CHECKS)) {
    const path = name === 'overview' ? `${root}/overview.json` : `${root}/reports/${name}.json`;
    if (!existsSync(path)) { missing++; total += checks.length; items[name] = { hit: 0, of: checks.length, missed: ['FILE MISSING'] }; continue; }
    const report = JSON.parse(readFileSync(path, 'utf8'));
    const text = [report.headline, report.summary, ...(report.highlights ?? [])].join(' ');
    const missed = checks.filter(([, test]) => !(typeof test === 'function' ? test(text) : test.test(text))).map(([label]) => label);
    items[name] = { hit: checks.length - missed.length, of: checks.length, missed };
    hit += checks.length - missed.length;
    total += checks.length;
    wordCount += words(text);
    if (sentences(report.summary) > (name === 'overview' ? 5 : 4)) overLimit++;
  }
  return { hit, total, percent: Math.round((100 * hit) / total), overLimit, words: wordCount, missing, items };
}
