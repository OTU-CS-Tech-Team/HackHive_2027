import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getVerifiedUser } from '@/lib/auth/helpers';

async function LoginContent() {
  const user = await getVerifiedUser();
  
  if (user) {
    redirect('/apply');
  }
  
  return (
    <div>
      <h1>Login</h1>
      <p>Login page - to be implemented by frontend team</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
