import assert from 'node:assert/strict';
import test from 'node:test';

import { deriveMotionObservations, planMotionSamplePositions } from '../src/motion.js';

test('plans five ordered scroll samples across available document range', () => {
  assert.deepEqual(planMotionSamplePositions(4_900, 900), [0, 1_000, 2_000, 3_000, 4_000]);
  assert.deepEqual(planMotionSamplePositions(700, 900), [0]);
});

test('derives scroll reveal, zoom, sticky, and video-progress observations from safe facts', () => {
  const observations = deriveMotionObservations({
    profile: 'desktop',
    samples: [
      {
        index: 0,
        scrollY: 0,
        facts: {
          regions: [
            { tag: 'section', role: null, box: { x: 0, y: 400, width: 800, height: 300 }, styles: { opacity: '0', position: 'static', transform: 'matrix(0.96, 0, 0, 0.96, 0, 0)' } },
            { tag: 'nav', role: 'navigation', box: { x: 0, y: 0, width: 800, height: 70 }, styles: { opacity: '1', position: 'sticky', transform: 'none' } },
          ],
          videos: [{ currentTime: 0, duration: 4, paused: true }],
        },
      },
      {
        index: 1,
        scrollY: 500,
        facts: {
          regions: [
            { tag: 'section', role: null, box: { x: 0, y: 80, width: 800, height: 300 }, styles: { opacity: '1', position: 'static', transform: 'matrix(1, 0, 0, 1, 0, 0)' } },
            { tag: 'nav', role: 'navigation', box: { x: 0, y: 0, width: 800, height: 70 }, styles: { opacity: '1', position: 'sticky', transform: 'none' } },
          ],
          videos: [{ currentTime: 2, duration: 4, paused: true }],
        },
      },
    ],
  });

  assert.deepEqual(observations.map((observation) => observation.kind), ['reveal', 'zoom', 'sticky', 'video-progress']);
  assert.ok(observations.every((observation) => observation.from.scrollY === 0 && observation.to.scrollY === 500));
  assert.equal(JSON.stringify(observations).includes('src='), false);
});
