import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getUser, isVerifiedUser } from '@/lib/auth/helpers';

async function VerifyEmailContent() {
  const user = await getUser();
  
  if (!user) {
    redirect('/auth/login');
  }
  
  if (isVerifiedUser(user)) {
    redirect('/apply');
  }
  
  return (
    <div>
      <h1>Verify Your Email</h1>
      <p>Please check your email and click the verification link.</p>
      <p>Email: {user.email}</p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
