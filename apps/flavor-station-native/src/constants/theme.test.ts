import { Colors } from '@/constants/theme';

describe('theme tokens', () => {
  it('matches the ported Flavor Station brand palette', () => {
    expect(Colors.dark.primary).toBe('#f97316');
    expect(Colors.dark.accent).toBe('#facc14');
    expect(Colors.dark.background).toBe('#050505');
  });

  it('is single-theme: light and dark resolve to the same brand palette', () => {
    expect(Colors.light).toEqual(Colors.dark);
  });
});
