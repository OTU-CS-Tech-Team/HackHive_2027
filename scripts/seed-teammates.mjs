// Persistent, explicitly labeled preview fixtures. Never send signup emails.
// Run: node --env-file=.env scripts/seed-teammates.mjs [--clean]
import { createClient } from '@supabase/supabase-js';
const SEED = 'hackhive-lfg-preview-v1';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Load the project .env before running this script.');
const settings = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, settings);
const required = async (query, label) => { const result = await query; if (result.error) throw new Error(`${label}: ${result.error.message}`); return result.data; };
const allUsers = [];
for (let page = 1; ; page++) { const result = await required(admin.auth.admin.listUsers({ page, perPage: 500 }), 'Find existing demo accounts'); allUsers.push(...result.users); if (result.users.length < 500) break; }
const demos = allUsers.filter(user => user.app_metadata?.fixture === SEED && /^hackhive-lfg-demo-\d{2}@example\.test$/.test(user.email ?? ''));
if (process.argv.includes('--clean')) {
  for (const user of demos) await required(admin.auth.admin.deleteUser(user.id), 'Remove demo account');
  console.log(`Removed ${demos.length} demo accounts and their profiles, teams, memberships, bookmarks, and join requests. Other accounts are unchanged.`);
  process.exit(0);
}
const roster = [
  ['Alex Chen', 'Backend', ['Python', 'FastAPI', 'Postgres'], ['Frontend', 'Design'], ['Accessibility', 'Campus life'], 'learn', 'An accessible campus navigation tool built around real student needs.'],
  ['Jordan Patel', 'Design', ['Figma', 'UX research', 'Prototyping'], ['Backend', 'Frontend'], ['Climate', 'Accessibility'], 'both', 'Helping students make sustainable choices without adding work to their day.'],
  ['Sam Rivera', 'AI / ML', ['Python', 'PyTorch', 'Data visualization'], ['Frontend', 'Product'], ['Education', 'AI'], 'compete', 'A study companion that adapts to how each person learns.'],
  ['Taylor Kim', 'Frontend', ['React', 'TypeScript', 'CSS'], ['Backend', 'Design'], ['Health', 'Accessibility'], 'learn', 'Making campus mental-health resources easier to discover.'],
  ['Morgan Lee', 'Hardware', ['Arduino', 'C++', 'Sensors'], ['Mobile', 'Design'], ['Climate', 'Hardware'], 'both', 'A tiny air-quality monitor with a useful, friendly dashboard.'],
  ['Casey Ali', 'Mobile', ['Flutter', 'Dart', 'Firebase'], ['Backend', 'Pitching'], ['Campus life', 'Games'], 'compete', 'A playful way to discover campus clubs and meet new people.'],
  ['Jamie Park', 'Product', ['Research', 'Storytelling', 'Pitching'], ['Frontend', 'AI / ML'], ['Education', 'Social good'], 'learn', 'Turning confusing scholarship requirements into a clear action plan.'],
  ['Drew Tran', 'Backend', ['Node.js', 'SQL', 'Docker'], ['Design', 'Frontend'], ['Games', 'Campus life'], 'both', 'A cooperative game for friends who have never met in person.'],
  ['Avery Morgan', 'Design', ['Figma', 'Illustration', 'Accessibility'], ['Frontend', 'Hardware'], ['Art', 'Accessibility'], 'learn', 'An expressive music tool that works with alternative input devices.'],
  ['Rory Singh', 'AI / ML', ['Python', 'OpenCV', 'TensorFlow'], ['Hardware', 'Pitching'], ['Climate', 'AI'], 'compete', 'Helping households waste less food with a camera and a useful reminder.'],
  ['Quinn Brooks', 'Frontend', ['Next.js', 'React', 'TypeScript'], ['Backend', 'Product'], ['Social good', 'Campus life'], 'both', 'A simple way for students to share tools, books, and practical help.'],
  ['Dakota Wells', 'Pitching', ['Public speaking', 'Video', 'Research'], ['Design', 'Mobile'], ['Health', 'Education'], 'learn', 'Finding a team with a useful idea and helping tell its story clearly.'],
  ['Robin Ellis', 'Frontend', ['React', 'Figma'], ['Backend', 'Design'], ['Accessibility'], 'learn', 'Building a campus guide with room for different strengths.'],
  ['Skyler Noor', 'Hardware', ['Arduino', 'Python'], ['Mobile', 'AI / ML'], ['Climate'], 'both', 'Making sustainability visible through small, thoughtful devices.'],
  ['Emery Stone', 'Product', ['Research', 'Pitching'], ['Frontend', 'Design'], ['Education'], 'compete', 'Helping students turn a big goal into one useful next step.'],
];
const schools = ['Ontario Tech University', 'University of Waterloo', 'University of Toronto', 'Toronto Metropolitan University'];
const accounts = [];
for (const [index, person] of roster.entries()) {
  const email = `hackhive-lfg-demo-${String(index + 1).padStart(2, '0')}@example.test`;
  let user = demos.find(candidate => candidate.email === email);
  if (!user) user = (await required(admin.auth.admin.createUser({ email, email_confirm: true, app_metadata: { fixture: SEED }, user_metadata: { full_name: `${person[0]} (TEST)` } }), 'Create demo account')).user;
  accounts.push({ ...user, email });
  await required(admin.from('applications').upsert({ user_id: user.id, email, status: 'submitted', decision: 'accepted', submitted_at: new Date().toISOString(), first_name: person[0].split(' ')[0], last_name: `${person[0].split(' ').slice(1).join(' ')} (TEST)` }, { onConflict: 'user_id' }), 'Set demo-only application access');
  await required(admin.from('profiles').update({ full_name: `${person[0]} (TEST)`, school: schools[index % schools.length], team_bio: `Fictional test profile. ${person[6]}`, team_roles: [person[1]], team_skills: person[2], team_seeking: person[3], team_interests: person[4], team_goal: person[5], team_experience: index % 3 ? 'returning' : 'first', slack_url:`https://hackhive-demo.slack.com/team/UDEMO${String(index + 1).padStart(5,'0')}`, github_url: `https://example.com/#hackhive-test-${index + 1}`, looking_for_team: index < 12, team_confirmed_at: new Date().toISOString() }).eq('id', user.id), 'Populate demo profile');
}
async function sessionFor(index) {
  const link = await required(admin.auth.admin.generateLink({ type: 'magiclink', email: accounts[index].email }), 'Create non-emailed demo session');
  const session = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, settings);
  await required(session.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' }), 'Sign in demo owner');
  return session;
}
const teams = [
  { name: 'Campus Compass (TEST)', pitch: 'Fictional recruiting team for testing. An accessible campus guide built around real student needs. Looking for curious people to build useful APIs and a thoughtful interface.', roles_needed: ['Backend', 'Design'], interests: ['Accessibility', 'Campus life'], goal: 'learn', capacity: 4 },
  { name: 'Honey, I Saved the Planet (TEST)', pitch: 'Fictional recruiting team for testing. A small air-quality sensor with a mobile dashboard. Help us turn environmental data into something people can act on.', roles_needed: ['Mobile', 'AI / ML'], interests: ['Climate', 'Hardware'], goal: 'both', capacity: 3 },
  { name: 'Study Swarm (TEST)', pitch: 'Fictional recruiting team for testing. An adaptive study companion. We have research and a clear problem; now we need a teammate who wants to build a polished prototype.', roles_needed: ['Frontend', 'Design'], interests: ['Education', 'AI'], goal: 'compete', capacity: 2 },
];
for (const [index, team] of teams.entries()) {
  const owner = await sessionFor(index + 12);
  try {
    const existing = await required(owner.from('recruiting_teams').select('id').eq('owner_id', accounts[index + 12].id).maybeSingle(), 'Find demo team');
    const slack_url = `https://hackhive-demo.slack.com/team/UDEMO${String(index + 13).padStart(5,'0')}`;
    if (existing) await required(owner.from('recruiting_teams').update({slack_url}).eq('id',existing.id), 'Update demo Slack contact');
    else await required(owner.from('recruiting_teams').insert({ ...team, slack_url, owner_id: accounts[index + 12].id }), 'Create recruiting team');
  } finally { await owner.auth.signOut({ scope: 'global' }); }
}
console.log('Seeded 12 discoverable TEST hackers and 3 TEST recruiting teams. Slack links are fictional member-profile placeholders; other links use example.com. No signup emails or external messages were sent.');
console.log('Cleanup: node --env-file=.env scripts/seed-teammates.mjs --clean');
