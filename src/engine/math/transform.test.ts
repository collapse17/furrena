import { describe, expect, it } from 'vitest';
import { identityMatrix, translationMatrix } from './transform';

describe('transform matrices', () => {
  it('creates the identity matrix', () => {
    expect(identityMatrix).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  });
  it('stores translation in the final matrix column', () => {
    expect(translationMatrix(2, -3, 5).slice(12, 15)).toEqual([2, -3, 5]);
  });
});
