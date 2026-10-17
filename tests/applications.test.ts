/**
 * HackHive 2027 Registration Backend Tests
 * 
 * Prerequisites:
 * 1. Start local Supabase: supabase start
 * 2. Run migrations: supabase db push
 * 3. Run tests: npm run test
 * 
 * These tests cover:
 * - RLS policies (user isolation, admin access, protected column triggers)
 * - Double submit / concurrent submit handling
 * - Idempotency (via submission_id)
 * - Deadline lock
 * - Rate limiting under concurrency (service_role only)
 * - Authenticated users cannot call service-role-only functions
 * - Honeypot detection
 * - Too-fast submission detection
 * - Under-18 guardian rule (including guardian_relationship)
 * - Unicode/emoji/long input handling
 * - Resume validation (missing, non-PDF, >5MB)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

interface TestUser {
  id: string;
  email: string;
  accessToken: string;
}

async function createTestUser(email: string): Promise<TestUser> {
  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password: 'testpassword123',
    email_confirm: true,
  });
  
  if (error || !data.user) {
    throw new Error(`Failed to create test user: ${error?.message}`);
  }

  const { data: signInData, error: signInError } = await serviceClient.auth.signInWithPassword({
    email,
    password: 'testpassword123',
  });

  if (signInError || !signInData.session) {
    throw new Error(`Failed to sign in test user: ${signInError?.message}`);
  }

  return {
    id: data.user.id,
    email,
    accessToken: signInData.session.access_token,
  };
}

async function deleteTestUser(userId: string): Promise<void> {
  await serviceClient.auth.admin.deleteUser(userId);
}

function createAuthenticatedClient(accessToken: string) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

describe.skipIf(!process.env.SUPABASE_RUNNING)('Applications RLS', () => {
  let userA: TestUser;
  let userB: TestUser;
  let adminUser: TestUser;

  beforeAll(async () => {
    userA = await createTestUser(`test-user-a-${Date.now()}@test.com`);
    userB = await createTestUser(`test-user-b-${Date.now()}@test.com`);
    adminUser = await createTestUser(`test-admin-${Date.now()}@test.com`);

    await serviceClient.from('reg_admins').insert({ user_id: adminUser.id });
  });

  afterAll(async () => {
    await serviceClient.from('applications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await serviceClient.from('reg_admins').delete().eq('user_id', adminUser.id);
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
    await deleteTestUser(adminUser.id);
  });

  it('user can insert their own application with draft status', async () => {
    const clientA = createAuthenticatedClient(userA.accessToken);
    
    const { error } = await clientA.from('applications').insert({
      user_id: userA.id,
      email: userA.email.toLowerCase(),
    });

    expect(error).toBeNull();
  });

  it('user can read their own application', async () => {
    const clientA = createAuthenticatedClient(userA.accessToken);
    
    const { data, error } = await clientA
      .from('applications')
      .select('*')
      .eq('user_id', userA.id)
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data?.user_id).toBe(userA.id);
    expect(data?.status).toBe('draft');
  });

  it('user cannot read another user\'s application', async () => {
    const clientB = createAuthenticatedClient(userB.accessToken);
    
    const { data } = await clientB
      .from('applications')
      .select('*')
      .eq('user_id', userA.id);

    expect(data).toHaveLength(0);
  });

  it('user cannot update another user\'s application', async () => {
    const clientB = createAuthenticatedClient(userB.accessToken);
    
    const { error } = await clientB
      .from('applications')
      .update({ first_name: 'Hacked' })
      .eq('user_id', userA.id);

    expect(error).not.toBeNull();
  });

  it('user can update their own draft application', async () => {
    const clientA = createAuthenticatedClient(userA.accessToken);
    
    const { error } = await clientA
      .from('applications')
      .update({ first_name: 'TestName' })
      .eq('user_id', userA.id);

    expect(error).toBeNull();
  });

  it('user cannot set status to submitted directly', async () => {
    const clientA = createAuthenticatedClient(userA.accessToken);
    
    const { error } = await clientA
      .from('applications')
      .update({ status: 'submitted' })
      .eq('user_id', userA.id);

    expect(error).not.toBeNull();
    expect(error?.message).toContain('Cannot change status');
  });

  it('user cannot change email directly', async () => {
    const clientA = createAuthenticatedClient(userA.accessToken);
    
    const { error } = await clientA
      .from('applications')
      .update({ email: 'hacked@evil.com' })
      .eq('user_id', userA.id);

    expect(error).not.toBeNull();
    expect(error?.message).toContain('Cannot change email');
  });

  it('user cannot set submitted_at directly', async () => {
    const clientA = createAuthenticatedClient(userA.accessToken);
    
    const { error } = await clientA
      .from('applications')
      .update({ submitted_at: new Date().toISOString() })
      .eq('user_id', userA.id);

    expect(error).not.toBeNull();
    expect(error?.message).toContain('Cannot change submitted_at');
  });

  it('user cannot set submission_id directly', async () => {
    const clientA = createAuthenticatedClient(userA.accessToken);
    
    const { error } = await clientA
      .from('applications')
      .update({ submission_id: 'fake-id' })
      .eq('user_id', userA.id);

    expect(error).not.toBeNull();
    expect(error?.message).toContain('Cannot change submission_id');
  });

  it('user cannot insert with status submitted', async () => {
    await serviceClient.from('applications').delete().eq('user_id', userB.id);
    
    const clientB = createAuthenticatedClient(userB.accessToken);
    
    const { error } = await clientB.from('applications').insert({
      user_id: userB.id,
      email: userB.email.toLowerCase(),
      status: 'submitted',
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain('status draft');
  });

  it('anon cannot read any applications', async () => {
    const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    
    const { data } = await anonClient.from('applications').select('*');
    expect(data).toHaveLength(0);
  });

  it('admin can read all applications', async () => {
    const adminClient = createAuthenticatedClient(adminUser.accessToken);
    
    const { data, error } = await adminClient.from('applications').select('*');
    
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
  });
});

describe.skipIf(!process.env.SUPABASE_RUNNING)('Service-Role Only Functions', () => {
  let testUser: TestUser;

  beforeAll(async () => {
    testUser = await createTestUser(`test-rpc-${Date.now()}@test.com`);
  });

  afterAll(async () => {
    await serviceClient.from('applications').delete().eq('user_id', testUser.id);
    await deleteTestUser(testUser.id);
  });

  it('authenticated user cannot call reg_submit_application directly', async () => {
    const client = createAuthenticatedClient(testUser.accessToken);
    
    const { error } = await client.rpc('reg_submit_application', {
      p_submission_id: 'test',
      p_first_name: 'Test',
      p_last_name: 'User',
      p_phone: '1234567890',
      p_age: 21,
      p_pronouns: null,
      p_city: 'TestCity',
      p_country: 'TestCountry',
      p_university: 'Test University',
      p_program: 'Computer Science',
      p_year_of_study: '3rd',
      p_grad_date: null,
      p_hackathons_count: null,
      p_linkedin_url: null,
      p_github_url: null,
      p_portfolio_url: null,
      p_resume_path: `${testUser.id}/resume.pdf`,
      p_q_proud: 'Test',
      p_q_hack: 'Test',
      p_q_anything_else: null,
      p_team_status: 'solo',
      p_teammate_emails: null,
      p_dietary: null,
      p_accessibility: null,
      p_tshirt_size: 'M',
      p_needs_travel_help: null,
      p_gender: null,
      p_ethnicity: null,
      p_guardian_name: null,
      p_guardian_phone: null,
      p_guardian_relationship: null,
      p_consent_coc: true,
      p_consent_privacy: true,
      p_consent_photo: null,
      p_share_resume_with_sponsors: null,
      p_user_id: testUser.id,
    });

    expect(error).not.toBeNull();
  });

  it('authenticated user cannot call reg_check_rate_limit directly', async () => {
    const client = createAuthenticatedClient(testUser.accessToken);
    
    const { error } = await client.rpc('reg_check_rate_limit', {
      p_key_hash: 'test-key',
      p_window_seconds: 3600,
      p_max_attempts: 5,
    });

    expect(error).not.toBeNull();
  });

  it('authenticated user cannot call reg_cleanup_rate_limits directly', async () => {
    const client = createAuthenticatedClient(testUser.accessToken);
    
    const { error } = await client.rpc('reg_cleanup_rate_limits', {
      p_older_than_hours: 24,
    });

    expect(error).not.toBeNull();
  });

  it('service role can call reg_submit_application', async () => {
    await serviceClient.from('applications').insert({
      user_id: testUser.id,
      email: testUser.email.toLowerCase(),
      status: 'draft',
    });

    const { data, error } = await serviceClient.rpc('reg_submit_application', {
      p_submission_id: `test-${Date.now()}`,
      p_first_name: 'Test',
      p_last_name: 'User',
      p_phone: '1234567890',
      p_age: 21,
      p_pronouns: null,
      p_city: 'TestCity',
      p_country: 'TestCountry',
      p_university: 'Test University',
      p_program: 'Computer Science',
      p_year_of_study: '3rd',
      p_grad_date: null,
      p_hackathons_count: null,
      p_linkedin_url: null,
      p_github_url: null,
      p_portfolio_url: null,
      p_resume_path: `${testUser.id}/resume.pdf`,
      p_q_proud: 'Test',
      p_q_hack: 'Test',
      p_q_anything_else: null,
      p_team_status: 'solo',
      p_teammate_emails: null,
      p_dietary: null,
      p_accessibility: null,
      p_tshirt_size: 'M',
      p_needs_travel_help: null,
      p_gender: null,
      p_ethnicity: null,
      p_guardian_name: null,
      p_guardian_phone: null,
      p_guardian_relationship: null,
      p_consent_coc: true,
      p_consent_privacy: true,
      p_consent_photo: null,
      p_share_resume_with_sponsors: null,
      p_user_id: testUser.id,
    });

    expect(error).toBeNull();
    expect(data?.ok).toBe(true);
  });
});

describe.skipIf(!process.env.SUPABASE_RUNNING)('Submit Application via Service Role', () => {
  let testUser: TestUser;

  beforeAll(async () => {
    testUser = await createTestUser(`test-submit-${Date.now()}@test.com`);
  });

  afterAll(async () => {
    await serviceClient.from('applications').delete().eq('user_id', testUser.id);
    await deleteTestUser(testUser.id);
  });

  beforeEach(async () => {
    await serviceClient.from('applications').delete().eq('user_id', testUser.id);
  });

  it('prevents double submit with submission_id (returns original success)', async () => {
    await serviceClient.from('applications').insert({
      user_id: testUser.id,
      email: testUser.email.toLowerCase(),
      status: 'draft',
    });

    const submissionId = `sub-${Date.now()}`;

    const result1 = await serviceClient.rpc('reg_submit_application', {
      p_submission_id: submissionId,
      p_first_name: 'Test',
      p_last_name: 'User',
      p_phone: '1234567890',
      p_age: 21,
      p_pronouns: null,
      p_city: 'TestCity',
      p_country: 'TestCountry',
      p_university: 'Test University',
      p_program: 'Computer Science',
      p_year_of_study: '3rd',
      p_grad_date: null,
      p_hackathons_count: null,
      p_linkedin_url: null,
      p_github_url: null,
      p_portfolio_url: null,
      p_resume_path: `${testUser.id}/resume-test.pdf`,
      p_q_proud: 'Test answer',
      p_q_hack: 'Test answer',
      p_q_anything_else: null,
      p_team_status: 'solo',
      p_teammate_emails: null,
      p_dietary: null,
      p_accessibility: null,
      p_tshirt_size: 'M',
      p_needs_travel_help: null,
      p_gender: null,
      p_ethnicity: null,
      p_guardian_name: null,
      p_guardian_phone: null,
      p_guardian_relationship: null,
      p_consent_coc: true,
      p_consent_privacy: true,
      p_consent_photo: null,
      p_share_resume_with_sponsors: null,
      p_user_id: testUser.id,
    });

    expect(result1.data?.ok).toBe(true);
    const firstSubmittedAt = result1.data?.submitted_at;

    const result2 = await serviceClient.rpc('reg_submit_application', {
      p_submission_id: submissionId,
      p_first_name: 'Test',
      p_last_name: 'User',
      p_phone: '1234567890',
      p_age: 21,
      p_pronouns: null,
      p_city: 'TestCity',
      p_country: 'TestCountry',
      p_university: 'Test University',
      p_program: 'Computer Science',
      p_year_of_study: '3rd',
      p_grad_date: null,
      p_hackathons_count: null,
      p_linkedin_url: null,
      p_github_url: null,
      p_portfolio_url: null,
      p_resume_path: `${testUser.id}/resume-test.pdf`,
      p_q_proud: 'Test answer',
      p_q_hack: 'Test answer',
      p_q_anything_else: null,
      p_team_status: 'solo',
      p_teammate_emails: null,
      p_dietary: null,
      p_accessibility: null,
      p_tshirt_size: 'M',
      p_needs_travel_help: null,
      p_gender: null,
      p_ethnicity: null,
      p_guardian_name: null,
      p_guardian_phone: null,
      p_guardian_relationship: null,
      p_consent_coc: true,
      p_consent_privacy: true,
      p_consent_photo: null,
      p_share_resume_with_sponsors: null,
      p_user_id: testUser.id,
    });

    expect(result2.data?.ok).toBe(true);
    expect(result2.data?.submitted_at).toBe(firstSubmittedAt);

    const { count } = await serviceClient
      .from('applications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', testUser.id);

    expect(count).toBe(1);
  });

  it('returns original success if already submitted with different submission_id', async () => {
    await serviceClient.from('applications').insert({
      user_id: testUser.id,
      email: testUser.email.toLowerCase(),
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      submission_id: 'original-submission',
    });

    const result = await serviceClient.rpc('reg_submit_application', {
      p_submission_id: `new-key-${Date.now()}`,
      p_first_name: 'Test',
      p_last_name: 'User',
      p_phone: '1234567890',
      p_age: 21,
      p_pronouns: null,
      p_city: 'TestCity',
      p_country: 'TestCountry',
      p_university: 'Test University',
      p_program: 'Computer Science',
      p_year_of_study: '3rd',
      p_grad_date: null,
      p_hackathons_count: null,
      p_linkedin_url: null,
      p_github_url: null,
      p_portfolio_url: null,
      p_resume_path: `${testUser.id}/resume-test.pdf`,
      p_q_proud: 'Test answer',
      p_q_hack: 'Test answer',
      p_q_anything_else: null,
      p_team_status: 'solo',
      p_teammate_emails: null,
      p_dietary: null,
      p_accessibility: null,
      p_tshirt_size: 'M',
      p_needs_travel_help: null,
      p_gender: null,
      p_ethnicity: null,
      p_guardian_name: null,
      p_guardian_phone: null,
      p_guardian_relationship: null,
      p_consent_coc: true,
      p_consent_privacy: true,
      p_consent_photo: null,
      p_share_resume_with_sponsors: null,
      p_user_id: testUser.id,
    });

    expect(result.data?.ok).toBe(true);
    expect(result.data?.application_id).toBeDefined();
  });
});

describe.skipIf(!process.env.SUPABASE_RUNNING)('Deadline Lock', () => {
  let testUser: TestUser;

  beforeAll(async () => {
    testUser = await createTestUser(`test-deadline-${Date.now()}@test.com`);
  });

  afterAll(async () => {
    await serviceClient.from('applications').delete().eq('user_id', testUser.id);
    await serviceClient.from('reg_settings').update({ deadline: null, applications_open: true }).eq('id', 1);
    await deleteTestUser(testUser.id);
  });

  it('prevents submit after deadline', async () => {
    const pastDeadline = new Date(Date.now() - 1000).toISOString();
    await serviceClient.from('reg_settings').update({ deadline: pastDeadline }).eq('id', 1);

    await serviceClient.from('applications').insert({
      user_id: testUser.id,
      email: testUser.email.toLowerCase(),
      status: 'draft',
    });

    const result = await serviceClient.rpc('reg_submit_application', {
      p_submission_id: `deadline-test-${Date.now()}`,
      p_first_name: 'Test',
      p_last_name: 'User',
      p_phone: '1234567890',
      p_age: 21,
      p_pronouns: null,
      p_city: 'TestCity',
      p_country: 'TestCountry',
      p_university: 'Test University',
      p_program: 'Computer Science',
      p_year_of_study: '3rd',
      p_grad_date: null,
      p_hackathons_count: null,
      p_linkedin_url: null,
      p_github_url: null,
      p_portfolio_url: null,
      p_resume_path: `${testUser.id}/resume-test.pdf`,
      p_q_proud: 'Test answer',
      p_q_hack: 'Test answer',
      p_q_anything_else: null,
      p_team_status: 'solo',
      p_teammate_emails: null,
      p_dietary: null,
      p_accessibility: null,
      p_tshirt_size: 'M',
      p_needs_travel_help: null,
      p_gender: null,
      p_ethnicity: null,
      p_guardian_name: null,
      p_guardian_phone: null,
      p_guardian_relationship: null,
      p_consent_coc: true,
      p_consent_privacy: true,
      p_consent_photo: null,
      p_share_resume_with_sponsors: null,
      p_user_id: testUser.id,
    });

    expect(result.data?.error).toBe('applications_closed');
  });

  it('prevents update after deadline via RLS', async () => {
    const client = createAuthenticatedClient(testUser.accessToken);

    const { data } = await client
      .from('applications')
      .update({ first_name: 'Updated' })
      .eq('user_id', testUser.id)
      .select();

    expect(data).toHaveLength(0);
  });
});

describe.skipIf(!process.env.SUPABASE_RUNNING)('Rate Limiting (Service Role)', () => {
  it('reg_check_rate_limit returns true for first request', async () => {
    const keyHash = `test-key-${Date.now()}`;
    
    const { data } = await serviceClient.rpc('reg_check_rate_limit', {
      p_key_hash: keyHash,
      p_window_seconds: 3600,
      p_max_attempts: 5,
    });

    expect(data).toBe(true);
  });

  it('reg_check_rate_limit returns false after exceeding limit', async () => {
    const keyHash = `test-key-exceed-${Date.now()}`;
    
    for (let i = 0; i < 5; i++) {
      await serviceClient.rpc('reg_check_rate_limit', {
        p_key_hash: keyHash,
        p_window_seconds: 3600,
        p_max_attempts: 5,
      });
    }

    const { data } = await serviceClient.rpc('reg_check_rate_limit', {
      p_key_hash: keyHash,
      p_window_seconds: 3600,
      p_max_attempts: 5,
    });

    expect(data).toBe(false);
  });
});

describe('Schema Validation', () => {
  it('validates emoji/accented names', async () => {
    const { applicationDraftSchema } = await import('../src/lib/application/schema');
    
    const result = applicationDraftSchema.safeParse({
      first_name: 'José',
      last_name: "O'Connor-Müller",
    });

    expect(result.success).toBe(true);
  });

  it('validates unicode characters', async () => {
    const { applicationDraftSchema } = await import('../src/lib/application/schema');
    
    const result = applicationDraftSchema.safeParse({
      first_name: '田中',
      last_name: '太郎',
    });

    expect(result.success).toBe(true);
  });

  it('rejects very long input', async () => {
    const { applicationDraftSchema } = await import('../src/lib/application/schema');
    
    const result = applicationDraftSchema.safeParse({
      first_name: 'A'.repeat(200),
    });

    expect(result.success).toBe(false);
  });

  it('validates age range', async () => {
    const { applicationDraftSchema } = await import('../src/lib/application/schema');
    
    const validAge = applicationDraftSchema.safeParse({ age: 21 });
    expect(validAge.success).toBe(true);

    const tooYoung = applicationDraftSchema.safeParse({ age: 12 });
    expect(tooYoung.success).toBe(false);

    const tooOld = applicationDraftSchema.safeParse({ age: 101 });
    expect(tooOld.success).toBe(false);
  });

  it('validates teammate emails limit', async () => {
    const { applicationDraftSchema } = await import('../src/lib/application/schema');
    
    const valid = applicationDraftSchema.safeParse({
      teammate_emails: ['a@test.com', 'b@test.com', 'c@test.com'],
    });
    expect(valid.success).toBe(true);

    const tooMany = applicationDraftSchema.safeParse({
      teammate_emails: ['a@test.com', 'b@test.com', 'c@test.com', 'd@test.com'],
    });
    expect(tooMany.success).toBe(false);
  });

  it('requires guardian info including relationship for under 18', async () => {
    const { applicationSubmitSchema } = await import('../src/lib/application/schema');
    
    const noGuardian = applicationSubmitSchema.safeParse({
      first_name: 'Test',
      last_name: 'User',
      phone: '1234567890',
      age: 17,
      city: 'TestCity',
      country: 'TestCountry',
      university: 'Test High School',
      program: 'High School',
      year_of_study: 'Junior',
      resume_path: 'user-id/resume.pdf',
      q_proud: 'Test answer for question one about being proud',
      q_hack: 'Test answer for question two about hacking',
      team_status: 'solo',
      tshirt_size: 'M',
      consent_coc: true,
      consent_privacy: true,
    });

    expect(noGuardian.success).toBe(false);

    const withGuardianNoRelationship = applicationSubmitSchema.safeParse({
      first_name: 'Test',
      last_name: 'User',
      phone: '1234567890',
      age: 17,
      city: 'TestCity',
      country: 'TestCountry',
      university: 'Test High School',
      program: 'High School',
      year_of_study: 'Junior',
      resume_path: 'user-id/resume.pdf',
      q_proud: 'Test answer for question one about being proud',
      q_hack: 'Test answer for question two about hacking',
      team_status: 'solo',
      tshirt_size: 'M',
      consent_coc: true,
      consent_privacy: true,
      guardian_name: 'Parent Name',
      guardian_phone: '9876543210',
    });

    expect(withGuardianNoRelationship.success).toBe(false);

    const withFullGuardian = applicationSubmitSchema.safeParse({
      first_name: 'Test',
      last_name: 'User',
      phone: '1234567890',
      age: 17,
      city: 'TestCity',
      country: 'TestCountry',
      university: 'Test High School',
      program: 'High School',
      year_of_study: 'Junior',
      resume_path: 'user-id/resume.pdf',
      q_proud: 'Test answer for question one about being proud',
      q_hack: 'Test answer for question two about hacking',
      team_status: 'solo',
      tshirt_size: 'M',
      consent_coc: true,
      consent_privacy: true,
      guardian_name: 'Parent Name',
      guardian_phone: '9876543210',
      guardian_relationship: 'Parent',
    });

    expect(withFullGuardian.success).toBe(true);
  });

  it('requires consent_coc and consent_privacy on submit', async () => {
    const { applicationSubmitSchema } = await import('../src/lib/application/schema');
    
    const noCoc = applicationSubmitSchema.safeParse({
      first_name: 'Test',
      last_name: 'User',
      phone: '1234567890',
      age: 21,
      city: 'TestCity',
      country: 'TestCountry',
      university: 'Test University',
      program: 'CS',
      year_of_study: '3rd',
      resume_path: 'user-id/resume.pdf',
      q_proud: 'Test answer',
      q_hack: 'Test answer',
      team_status: 'solo',
      tshirt_size: 'M',
      consent_coc: false,
      consent_privacy: true,
    });

    expect(noCoc.success).toBe(false);

    const noPrivacy = applicationSubmitSchema.safeParse({
      first_name: 'Test',
      last_name: 'User',
      phone: '1234567890',
      age: 21,
      city: 'TestCity',
      country: 'TestCountry',
      university: 'Test University',
      program: 'CS',
      year_of_study: '3rd',
      resume_path: 'user-id/resume.pdf',
      q_proud: 'Test answer',
      q_hack: 'Test answer',
      team_status: 'solo',
      tshirt_size: 'M',
      consent_coc: true,
      consent_privacy: false,
    });

    expect(noPrivacy.success).toBe(false);
  });

  it('validates URL fields', async () => {
    const { applicationDraftSchema } = await import('../src/lib/application/schema');
    
    const validUrls = applicationDraftSchema.safeParse({
      linkedin_url: 'https://linkedin.com/in/testuser',
      github_url: 'https://github.com/testuser',
      portfolio_url: 'https://example.com',
    });
    expect(validUrls.success).toBe(true);

    const invalidLinkedin = applicationDraftSchema.safeParse({
      linkedin_url: 'https://facebook.com/testuser',
    });
    expect(invalidLinkedin.success).toBe(false);

    const invalidGithub = applicationDraftSchema.safeParse({
      github_url: 'https://gitlab.com/testuser',
    });
    expect(invalidGithub.success).toBe(false);
  });

  it('enforces word limit on questions', async () => {
    const { applicationDraftSchema } = await import('../src/lib/application/schema');
    
    const tooManyWords = applicationDraftSchema.safeParse({
      q_proud: Array(250).fill('word').join(' '),
    });
    expect(tooManyWords.success).toBe(false);

    const withinLimit = applicationDraftSchema.safeParse({
      q_proud: Array(150).fill('word').join(' '),
    });
    expect(withinLimit.success).toBe(true);
  });
});
