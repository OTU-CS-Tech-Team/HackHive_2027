'use client';
import { useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { filterTeammates, teamSchools, matchReasons, introduction, TEAM_ROLES, TEAM_GOALS, type TeamProfile, type Bookmark } from '@/lib/team/profiles';
import { updateBookmark, type TeamActionResult } from './actions';
import { updateTeamQuery } from './team-query';
import { ProfileCard } from './ProfileCard';
import { Modal } from './Modal';
import { Icon } from './Icon';
import styles from './team.module.css';

const filterKeys = ['q', 'school', 'role', 'interest', 'goal', 'first', 'github', 'hide-contacted'];
export function TeamDirectory({ profiles, own, bookmarks, upgraded, savedOnly = false }: {
  profiles: TeamProfile[]; own: TeamProfile; bookmarks: Bookmark[]; upgraded: boolean; savedOnly?: boolean;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [intro, setIntro] = useState<TeamProfile | null>(null);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<TeamActionResult | null>(null);
  const marks = useMemo(() => new Map(bookmarks.map(bookmark => [bookmark.target_id, bookmark])), [bookmarks]);
  const schools = useMemo(() => teamSchools(profiles), [profiles]);
  const interests = useMemo(() => [...new Set(profiles.flatMap(profile => profile.interests))].sort((a, b) => a.localeCompare(b)), [profiles]);
  const q = params.get('q') ?? '', school = params.get('school') ?? '', role = params.get('role') ?? '';
  const interest = params.get('interest') ?? '', goal = params.get('goal') ?? '';
  const github = params.get('github') === '1', first = params.get('first') === '1', hideContacted = params.get('hide-contacted') === '1';
  const sort = ['recent', 'name'].includes(params.get('sort') ?? '') ? params.get('sort')! : 'recommended';
  const activeCount = filterKeys.filter(key => !!params.get(key)).length;
  const clear = () => updateTeamQuery(Object.fromEntries(filterKeys.map(key => [key, null])));
  const filtered = useMemo(() => {
    const people = filterTeammates(profiles, q, school, github).filter(profile =>
      (!savedOnly || marks.get(profile.id)?.saved) && (!role || profile.roles.includes(role)) &&
      (!interest || profile.interests.includes(interest)) && (!goal || profile.goal === goal) &&
      (!first || profile.experience === 'first') && (!hideContacted || !marks.get(profile.id)?.reached_out));
    const date = (profile: TeamProfile) => profile.confirmedAt ? Date.parse(profile.confirmedAt) || 0 : 0;
    return people.sort((a, b) => {
      if (sort === 'recommended') {
        const diff = matchReasons(own, b).length - matchReasons(own, a).length;
        if (diff) return diff;
      }
      if (sort !== 'name') { const diff = date(b) - date(a); if (diff) return diff; }
      return a.name.localeCompare(b.name, 'en') || a.id.localeCompare(b.id);
    });
  }, [profiles, q, school, github, savedOnly, marks, role, interest, goal, first, hideContacted, sort, own]);
  const shown = Math.min(Math.max(9, Number(params.get('shown')) || 9), Math.max(filtered.length, 9));
  const visible = filtered.slice(0, shown);
  const change = (key: string, value: string) => updateTeamQuery({ [key]: value || null });
  const mutate = (work: () => Promise<TeamActionResult>) => {
    setFeedback(null);
    startTransition(async () => {
      try { const result = await work(); setFeedback(result); if (result.ok) router.refresh(); }
      catch { setFeedback({ ok: false, message: 'This change could not be saved. Try again.' }); }
    });
  };

  return <section aria-labelledby="directory-heading" aria-busy={pending}>
    <div className={styles.sectionHead}>
      <div><h2 id="directory-heading">{savedOnly ? 'Your shortlist' : 'Meet your next teammate.'}</h2><p className={`${styles.small} ${styles.desktopOnly}`}>{savedOnly ? 'Saved just for you. Other hackers cannot see this list.' : 'Different skills. Shared curiosity. Find someone you’d love to build with.'}</p></div>
      <button type="button" className={styles.quiet} disabled={pending} onClick={() => startTransition(() => router.refresh())} aria-label="Refresh teammate directory">↻ Refresh</button>
    </div>
    <div className={styles.searchRow}>
      <label className={styles.search}><Icon name="search" /><span className={styles.srOnly}>Search hackers</span><input type="search" maxLength={100} value={q} onChange={event => change('q', event.target.value)} placeholder="Search skills, ideas, names…" /></label>
      <select className={styles.quickSelect} value={role} onChange={event => change('role', event.target.value)} aria-label="Filter by role"><option value="">Any role</option>{TEAM_ROLES.map(value => <option key={value}>{value}</option>)}</select>
      <select className={styles.quickSelect} value={interest} onChange={event => change('interest', event.target.value)} aria-label="Filter by interest"><option value="">Any interest</option>{interests.map(value => <option key={value}>{value}</option>)}</select>
      <button type="button" className={`${styles.secondary} ${styles.desktopOnly}`} onClick={() => setFiltersOpen(true)}><Icon name="filters" />Filters{activeCount ? ` (${activeCount})` : ''}</button>
    </div>
    {!!activeCount && <div className={styles.activeFilters}><span className={styles.small}>{activeCount} active {activeCount === 1 ? 'filter' : 'filters'}</span><button className={styles.quiet} onClick={clear} type="button">Clear all ×</button></div>}
    <div className={styles.resultRow}>
      <p className={styles.small} role="status" aria-live="polite">{filtered.length ? `${Math.min(shown, filtered.length)} of ${filtered.length.toLocaleString('en-US')} hackers` : 'No matching hackers'}</p>
      <div className={styles.inlineActions}><label className={styles.sort}><span className={styles.desktopOnly}>Sort by</span><select aria-label="Sort hackers" value={sort} onChange={event => change('sort', event.target.value)}><option value="recommended">Suggested for you</option><option value="recent">Recently confirmed</option><option value="name">Name</option></select></label><button type="button" className={`${styles.secondary} ${styles.mobileOnly}`} onClick={() => setFiltersOpen(true)}><Icon name="filters" />Filters{activeCount ? ` (${activeCount})` : ''}</button></div>
    </div>
    {feedback && <p role={feedback.ok ? 'status' : 'alert'} className={styles.feedback}>{feedback.message}</p>}
    {visible.length ? <ul className={styles.grid}>{visible.map(profile => <li className="flex min-w-0" key={profile.id}><ProfileCard profile={profile}
      saved={marks.get(profile.id)?.saved} contacted={marks.get(profile.id)?.reached_out} disabled={pending}
      reasons={sort === 'recommended' ? matchReasons(own, profile) : []}
      onSave={upgraded ? () => mutate(() => updateBookmark(profile.id, 'saved', !marks.get(profile.id)?.saved)) : undefined}
      onContacted={upgraded ? value => mutate(() => updateBookmark(profile.id, 'reached_out', value)) : undefined}
      onIntroduce={() => setIntro(profile)} /></li>)}</ul> :
      <div className={styles.empty}><span aria-hidden="true">✦</span><h3>{activeCount ? 'Your people might be one filter away.' : savedOnly ? 'Make room for a few great possibilities.' : 'A great team could start with you.'}</h3>
        <p>{activeCount ? 'Try another skill or widen your search. Your next teammate could be from any school.' : savedOnly ? 'Save profiles as you browse. They will appear here while those hackers are discoverable.' : 'No other hackers are listed yet. Make yourself discoverable and check back as people join.'}</p>
        {activeCount ? <button className={styles.secondary} type="button" onClick={clear}>Show all hackers</button> : savedOnly ? <button className={styles.secondary} type="button" onClick={() => updateTeamQuery({ view: null })}>Explore hackers</button> : null}
      </div>}
    {shown < filtered.length && <div className={styles.loadMore}><button type="button" className={styles.secondary} onClick={() => updateTeamQuery({ shown: String(shown + 9) }, false)}>Meet 9 more hackers ↓</button><span className={styles.small}>Keep exploring at your own pace.</span></div>}
    {filtersOpen && <Modal title="Find your kind of team" onClose={() => setFiltersOpen(false)}><div className={styles.form}>
      <div className={styles.formGrid}>
        <label>Role<select value={role} onChange={e => change('role', e.target.value)}><option value="">Any role</option>{TEAM_ROLES.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Interest<select value={interest} onChange={e => change('interest', e.target.value)}><option value="">Any interest</option>{interests.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Goal<select value={goal} onChange={e => change('goal', e.target.value)}><option value="">Any goal</option>{Object.entries(TEAM_GOALS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>School<select value={school} onChange={e => change('school', e.target.value)}><option value="">All schools</option>{schools.map(value => <option value={value.value} key={value.value}>{value.label}</option>)}</select></label>
      </div>
      <label className={styles.checkLabel}><input type="checkbox" checked={first} onChange={e => change('first', e.target.checked ? '1' : '')} />First-time hackers</label>
      <label className={styles.checkLabel}><input type="checkbox" checked={hideContacted} onChange={e => change('hide-contacted', e.target.checked ? '1' : '')} />Hide people I&apos;ve reached out to</label>
      <label className={styles.checkLabel}><input type="checkbox" checked={github} onChange={e => change('github', e.target.checked ? '1' : '')} />Has a GitHub profile (optional)</label>
      <div className={styles.inlineActions}><button className={styles.primary} type="button" onClick={() => setFiltersOpen(false)}>Show {filtered.length} hackers</button><button type="button" className={styles.quiet} onClick={clear}>Reset filters</button></div>
    </div></Modal>}
    {intro && <Introduction own={own} profile={intro} onClose={() => setIntro(null)} />}
  </section>;
}

function Introduction({ own, profile, onClose }: { own: TeamProfile; profile: TeamProfile; onClose: () => void }) {
  const [message, setMessage] = useState(() => introduction(own, profile));
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const links = [['Open Slack', profile.slackUrl], ['Open GitHub', profile.githubUrl], ['Open LinkedIn', profile.linkedinUrl], ['Open Instagram', profile.instagramUrl]].filter(([, href]) => !!href);
  return <Modal title={`Say hello to ${profile.name.split(' ')[0]}`} onClose={onClose}>
    <div className="mb-4"><p className={styles.bio}>{profile.bio || 'No project idea added yet.'}</p><div className={styles.chipGroup}>{[...new Set([...profile.roles, ...profile.skills])].map(value => <span className={styles.chip} key={value}>{value}</span>)}</div>
      {matchReasons(own, profile).length > 0 && <ul className={styles.match}>{matchReasons(own, profile).map(reason => <li key={reason}>✦ {reason}</li>)}</ul>}
    </div>
    <p className={`${styles.small} mb-4`}>Start with something personal. Edit this introduction, copy it, then send it yourself. Nothing is sent automatically.</p>
    <label className={styles.fieldLabel}>Your introduction<textarea className={styles.textarea} maxLength={1200} value={message} onChange={event => { setMessage(event.target.value); setCopyState('idle'); }} /></label>
    <div className={`${styles.inlineActions} mt-4`}>
      <button type="button" className={styles.primary} onClick={async () => { try { await navigator.clipboard.writeText(message); setCopyState('copied'); } catch { setCopyState('failed'); } }}>{copyState === 'copied' ? 'Copied ✓' : 'Copy introduction'}</button>
      {links.map(([label, href]) => <a className={styles.secondary} href={href!} key={label} target="_blank" rel="noopener noreferrer">{label} ↗</a>)}
    </div>
    {copyState !== 'idle' && <p className={`${styles.small} mt-3`} role={copyState === 'failed' ? 'alert' : 'status'}>{copyState === 'copied' ? 'Ready to paste. After you send it, mark “I reached out” on their card if you’d like.' : 'Clipboard access is unavailable. Select the text and copy it manually.'}</p>}
    {!profile.slackUrl && <p className={`${styles.small} mt-3`}>They haven&apos;t added Slack. Use one of their other profile links to connect.</p>}
  </Modal>;
}
