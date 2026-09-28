import { describe, expect, it } from 'vitest';
import type { Visitor } from '../src/sim/GameState';
import type { Topic } from '../src/sim/data/thoughts';
import { boxEdges } from '../src/sim/grid';
import { reviewStars } from '../src/sim/systems/visitors';

const visitor = (id: number, satisfaction: number, complaints: Topic[], praise: Topic[] = ['dinos']): Visitor =>
  ({
    id,
    satisfaction,
    thoughts: [
      ...complaints.map((topic) => ({ hour: 0, topic, good: false, text: 'grr' })),
      ...praise.map((topic) => ({ hour: 0, topic, good: true, text: 'yay' })),
    ],
  }) as unknown as Visitor;

describe('reviews', () => {
  it('a delighted visitor with nothing to complain about gives 5 stars', () => {
    for (let id = 1; id <= 20; id++) expect(reviewStars(visitor(id, 100, []))).toBe(5);
  });

  it('every different complaint caps the stars, however happy the visitor ended up', () => {
    for (let id = 1; id <= 20; id++) {
      expect(reviewStars(visitor(id, 100, ['price']))).toBeLessThanOrEqual(4);
      expect(reviewStars(visitor(id, 100, ['price', 'restroom']))).toBeLessThanOrEqual(3);
      expect(reviewStars(visitor(id, 100, ['price', 'restroom', 'mess']))).toBeLessThanOrEqual(2);
    }
  });

  it('the same complaint twice counts once, and unhappy visitors still give low stars', () => {
    expect(reviewStars(visitor(1, 100, ['price', 'price']))).toBe(reviewStars(visitor(1, 100, ['price'])));
    for (let id = 1; id <= 20; id++) expect(reviewStars(visitor(id, 15, []))).toBeLessThanOrEqual(2);
  });
});

describe('fence boxes', () => {
  it('a diagonal drag fences the whole box; a straight drag makes one line', () => {
    const box = boxEdges(2, 3, 6, 5);
    expect(box.filter((e) => e.dir === 'h')).toHaveLength(8); // top and bottom, 4 each
    expect(box.filter((e) => e.dir === 'v')).toHaveLength(4); // left and right, 2 each
    expect(new Set(box.map((e) => `${e.dir}${e.x},${e.y}`)).size).toBe(box.length);
    expect(boxEdges(2, 3, 6, 3)).toHaveLength(4);
    expect(boxEdges(2, 3, 2, 7)).toHaveLength(4);
  });
});
