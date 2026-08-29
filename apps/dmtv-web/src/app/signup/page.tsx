import { signUpAction } from "./actions";

export default function SignUpPage() {
  return (
    <main>
      <h1>Creator sign up</h1>
      <p className="muted">Step 1 of the DMTV lifecycle: create your account and your own creator organization.</p>
      <form action={signUpAction} className="card">
        <label htmlFor="displayName">Your name</label>
        <input id="displayName" name="displayName" required placeholder="Nova Rey" />

        <label htmlFor="organizationName">Creator business name</label>
        <input id="organizationName" name="organizationName" required placeholder="Nova Sound Studio" />

        <button type="submit">Create my account</button>
      </form>
    </main>
  );
}
