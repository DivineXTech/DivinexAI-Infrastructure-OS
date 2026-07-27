import { fireEvent, render, waitFor } from '@testing-library/react-native';

import SignInScreen from '@/app/sign-in';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

const mockSignInWithOtp = jest.fn<Promise<{ error: string | null }>, [string]>(() =>
  Promise.resolve({ error: null })
);
jest.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ signInWithOtp: mockSignInWithOtp }),
}));

describe('SignInScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects an invalid email without calling signInWithOtp', async () => {
    const { getByText, getByPlaceholderText } = render(<SignInScreen />);
    fireEvent.changeText(getByPlaceholderText('your@email.com'), 'not-an-email');
    fireEvent.press(getByText('Send code'));

    await waitFor(() => expect(getByText('Enter a valid email address.')).toBeTruthy());
    expect(mockSignInWithOtp).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('submits a valid email and navigates to /verify with it', async () => {
    const { getByText, getByPlaceholderText } = render(<SignInScreen />);
    fireEvent.changeText(getByPlaceholderText('your@email.com'), 'diner@example.com');
    fireEvent.press(getByText('Send code'));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/verify',
        params: { email: 'diner@example.com' },
      })
    );
    expect(mockSignInWithOtp).toHaveBeenCalledWith('diner@example.com');
  });

  it('shows the error returned by signInWithOtp and does not navigate', async () => {
    mockSignInWithOtp.mockResolvedValueOnce({ error: 'rate limited' });
    const { getByText, getByPlaceholderText } = render(<SignInScreen />);
    fireEvent.changeText(getByPlaceholderText('your@email.com'), 'diner@example.com');
    fireEvent.press(getByText('Send code'));

    await waitFor(() => expect(getByText('rate limited')).toBeTruthy());
    expect(mockPush).not.toHaveBeenCalled();
  });
});
