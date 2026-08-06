import assert from 'node:assert/strict';
import test from 'node:test';

import { RANKING_WEIGHTS, computeApplicantRankingScore } from './statistics.service.js';

const score = mean => computeApplicantRankingScore({ mean });

test('views outrank the other means at equal magnitude', () => {
  const viewsHeavy = score({ views: 10_000, followers: 1_000, engagement: 1_000 });
  const followersHeavy = score({ views: 1_000, followers: 10_000, engagement: 1_000 });
  const engagementHeavy = score({ views: 1_000, followers: 1_000, engagement: 10_000 });

  assert.ok(viewsHeavy > followersHeavy, 'views should beat followers');
  assert.ok(viewsHeavy > engagementHeavy, 'views should beat engagement');
  assert.equal(followersHeavy, engagementHeavy, 'followers and engagement carry equal weight');
});

test('weights are not swamped by raw scale differences', () => {
  /*
   * The failure a plain weighted sum has: followers routinely run an order of
   * magnitude above engagement, so 0.5 * views loses to 0.25 * followers on raw
   * numbers alone. Here the creator with far better views must still win.
   */
  const strongViews = score({ views: 50_000, followers: 5_000, engagement: 2_000 });
  const strongFollowers = score({ views: 2_000, followers: 500_000, engagement: 2_000 });

  assert.ok(strongViews > strongFollowers, 'a views-led creator outranks a followers-led one');
});

test('a missing metric renormalises instead of counting as zero', () => {
  const withoutFollowers = score({ views: 10_000, followers: null, engagement: 500 });
  const withZeroFollowers = score({ views: 10_000, followers: 0, engagement: 500 });

  assert.ok(
    withoutFollowers > withZeroFollowers,
    'an unreadable follower count must not be punished like a real zero'
  );
});

test('scoring is monotonic in every component', () => {
  const base = { views: 1_000, followers: 1_000, engagement: 1_000 };
  for (const key of Object.keys(RANKING_WEIGHTS)) {
    assert.ok(
      score({ ...base, [key]: 2_000 }) > score(base),
      `a larger ${key} mean must never lower the score`
    );
  }
});

test('nothing known scores zero rather than throwing', () => {
  assert.equal(score({ views: null, followers: null, engagement: null }), 0);
  assert.equal(computeApplicantRankingScore(null), 0);
  assert.equal(computeApplicantRankingScore({}), 0);
});

test('accepts either a full statistics payload or a bare mean', () => {
  const mean = { views: 12_300, followers: 21_000, engagement: 810.33 };
  assert.equal(computeApplicantRankingScore({ mean }), computeApplicantRankingScore(mean));
});

test('descending sort by score puts the strongest applicant first', () => {
  const applicants = [
    { name: 'low', mean: { views: 400, followers: 900, engagement: 30 } },
    { name: 'high', mean: { views: 90_000, followers: 40_000, engagement: 5_000 } },
    { name: 'mid', mean: { views: 9_000, followers: 12_000, engagement: 700 } }
  ].map(applicant => ({ ...applicant, rankingScore: score(applicant.mean) }));

  const ordered = [...applicants].sort((a, b) => b.rankingScore - a.rankingScore).map(item => item.name);
  assert.deepEqual(ordered, ['high', 'mid', 'low']);
});
