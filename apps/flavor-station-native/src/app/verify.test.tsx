import { fireEvent, render, waitFor } from '@testing-library/react-native';

import VerifyScreen from '@/app/verify';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
  useLocalSearchParams: () => ({ email: 'diner@example.com' }),
}));

const mockVerifyOtp = jest.fn<Promise<{ error: string | null }>, [string, string]>(() =>
  Promise.resolve({ error: null })
);
const mockSignInWithOtp = jest.fn(() => Promise.resolve({ error: null as string | null }));
jest.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ verifyOtp: mockVerifyOtp, signInWithOtp: mockSignInWithOtp }),
}));

describe('VerifyScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a short code without calling verifyOtp', async () => {
    const { getByText, getByPlaceholderText } = render(<VerifyScreen />);
    fireEvent.changeText(getByPlaceholderText('123456'), '123');
    fireEvent.press(getByText('Verify'));

    await waitFor(() => expect(getByText('Enter the 6-digit code from your email.')).toBeTruthy());
    expect(mockVerifyOtp).not.toHaveBeenCalled();
  });

  it('verifies a valid code and navigates to /account', async () => {
    const { getByText, getByPlaceholderText } = render(<VerifyScreen />);
    fireEvent.changeText(getByPlaceholderText('123456'), '654321');
    fireEvent.press(getByText('Verify'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/account'));
    expect(mockVerifyOtp).toHaveBeenCalledWith('diner@example.com', '654321');
  });

  it('shows the error returned by verifyOtp and does not navigate', async () => {
    mockVerifyOtp.mockResolvedValueOnce({ error: 'invalid code' });
    const { getByText, getByPlaceholderText } = render(<VerifyScreen />);
    fireEvent.changeText(getByPlaceholderText('123456'), '000000');
    fireEvent.press(getByText('Verify'));

    await waitFor(() => expect(getByText('invalid code')).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('resend calls signInWithOtp again with the same email', async () => {
    const { getByText } = render(<VerifyScreen />);
    fireEvent.press(getByText('Resend code'));

    await waitFor(() => expect(mockSignInWithOtp).toHaveBeenCalledWith('diner@example.com'));
    await waitFor(() => expect(getByText('New code sent.')).toBeTruthy());
  });
});
