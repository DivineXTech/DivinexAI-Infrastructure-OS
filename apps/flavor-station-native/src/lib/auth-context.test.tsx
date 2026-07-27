import { act, render, renderHook, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AuthProvider, useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

let authStateCallback: (event: string, session: unknown) => void = () => {};

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(() => Promise.resolve({ data: { session: null } })),
      onAuthStateChange: jest.fn((cb: (event: string, session: unknown) => void) => {
        authStateCallback = cb;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }),
      signInWithOtp: jest.fn<Promise<{ error: { message: string } | null }>, [unknown]>(() =>
        Promise.resolve({ error: null })
      ),
      verifyOtp: jest.fn(() => Promise.resolve({ error: null })),
      signOut: jest.fn(() => Promise.resolve({ error: null })),
    },
  },
}));

function Consumer() {
  const { user, loading } = useAuth();
  return <Text>{loading ? 'loading' : user ? `signed-in:${user.email}` : 'signed-out'}</Text>;
}

const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;

describe('AuthProvider / useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves to signed-out once getSession returns no session', async () => {
    const { getByText } = render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );
    await waitFor(() => expect(getByText('signed-out')).toBeTruthy());
  });

  it('updates to signed-in when onAuthStateChange fires with a session', async () => {
    const { getByText } = render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );
    await waitFor(() => expect(getByText('signed-out')).toBeTruthy());

    act(() => {
      authStateCallback('SIGNED_IN', { user: { email: 'diner@example.com' } });
    });

    await waitFor(() => expect(getByText('signed-in:diner@example.com')).toBeTruthy());
  });

  it('signInWithOtp calls supabase with shouldCreateUser and surfaces errors as strings', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      const outcome = await result.current.signInWithOtp('diner@example.com');
      expect(outcome.error).toBeNull();
    });
    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'diner@example.com',
      options: { shouldCreateUser: true },
    });

    (supabase.auth.signInWithOtp as jest.Mock).mockResolvedValueOnce({
      error: { message: 'rate limited' },
    });
    await act(async () => {
      const outcome = await result.current.signInWithOtp('diner@example.com');
      expect(outcome.error).toBe('rate limited');
    });
  });

  it('signOut calls supabase.auth.signOut', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signOut();
    });
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });
});
