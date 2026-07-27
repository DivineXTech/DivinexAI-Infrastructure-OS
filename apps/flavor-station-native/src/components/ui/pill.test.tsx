import { render } from '@testing-library/react-native';

import { Pill } from '@/components/ui/pill';

describe('Pill', () => {
  it('renders its label', () => {
    const { getByText } = render(<Pill label="Coming Soon" />);
    expect(getByText('Coming Soon')).toBeTruthy();
  });
});
