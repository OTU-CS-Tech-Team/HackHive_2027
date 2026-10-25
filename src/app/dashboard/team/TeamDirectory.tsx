'use client';
import { useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { filterTeammates, teamSchools, matchReasons, TEAM_ROLES, TEAM_GOALS, type TeamProfile, type Bookmark } from '@/lib/team/profiles';
import { updateBookmark, type TeamActionResult } from './actions';
import { updateTeamQuery } from './team-query';
import { ProfileCard } from './ProfileCard';
import { Modal } from './Modal';
import { Icon } from './Icon';
import { SelectControl } from './SelectControl';
import styles from './team.module.css';

const filterKeys = ['q', 'school', 'role', 'interest', 'goal', 'first', 'github'];
export function TeamDirectory({ profiles, own, bookmarks, upgraded, savedOnly = false }: {
  profiles: TeamProfile[]; own: TeamProfile; bookmarks: Bookmark[]; upgraded: boolean; savedOnly?: boolean;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<TeamActionResult | null>(null);
  const marks = useMemo(() => new Map(bookmarks.map(bookmark => [bookmark.target_id, bookmark])), [bookmarks]);
  const schools = useMemo(() => teamSchools(profiles), [profiles]);
  const interests = useMemo(() => [...new Set(profiles.flatMap(profile => profile.interests))].sort((a, b) => a.localeCompare(b)), [profiles]);
  const q = params.get('q') ?? '', school = params.get('school') ?? '', role = params.get('role') ?? '';
  const interest = params.get('interest') ?? '', goal = params.get('goal') ?? '';
  const github = params.get('github') === '1', first = params.get('first') === '1';
  const sort = ['recent', 'name'].includes(params.get('sort') ?? '') ? params.get('sort')! : 'recommended';
  const activeCount = filterKeys.filter(key => !!params.get(key)).length;
  const clear = () => updateTeamQuery(Object.fromEntries(filterKeys.map(key => [key, null])));
  const filtered = useMemo(() => {
    const people = filterTeammates(profiles, q, school, github).filter(profile =>
      (!savedOnly || marks.get(profile.id)?.saved) && (!role || profile.roles.includes(role)) &&
      (!interest || profile.interests.includes(interest)) && (!goal || profile.goal === goal) &&
      (!first || profile.experience === 'first'));
    const date = (profile: TeamProfile) => profile.confirmedAt ? Date.parse(profile.confirmedAt) || 0 : 0;
    return people.sort((a, b) => {
      if (sort === 'recommended') {
        const diff = matchReasons(own, b).length - matchReasons(own, a).length;
        if (diff) return diff;
      }
      if (sort !== 'name') { const diff = date(b) - date(a); if (diff) return diff; }
      return a.name.localeCompare(b.name, 'en') || a.id.localeCompare(b.id);
    });
  }, [profiles, q, school, github, savedOnly, marks, role, interest, goal, first, sort, own]);
  const shown = Math.min(Math.max(9, Math.floor(Number(params.get('shown'))) || 9), Math.max(filtered.length, 9));
  const visible = filtered.slice(0, shown);
  const nextBatch = Math.min(9, filtered.length - shown);
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
      <div><h2 id="directory-heading">{savedOnly ? 'Saved hackers' : 'Hackers looking for a team'}</h2><p className={`${styles.small} ${styles.desktopOnly}`}>{savedOnly ? 'Your private shortlist.' : 'Find complementary skills, shared interests, and a similar goal.'}</p></div>
      <button type="button" className={styles.quiet} disabled={pending} onClick={() => startTransition(() => router.refresh())} aria-label="Refresh teammate directory">↻ Refresh</button>
    </div>
    <div className={styles.searchRow}>
      <label className={styles.search}><Icon name="search" /><span className={styles.srOnly}>Search hackers</span><input type="search" maxLength={100} value={q} onChange={event => change('q', event.target.value)} placeholder="Search skills, ideas, names…" /></label>
      <SelectControl className={styles.quickSelect} value={role} onValueChange={value => change('role', value)} label="Filter by role" options={[{value:'',label:'Any role'},...TEAM_ROLES.map(value=>({value,label:value}))]} />
      <SelectControl className={styles.quickSelect} value={interest} onValueChange={value => change('interest', value)} label="Filter by interest" options={[{value:'',label:'Any interest'},...interests.map(value=>({value,label:value}))]} />
      <button type="button" className={`${styles.secondary} ${styles.desktopOnly}`} onClick={() => setFiltersOpen(true)}><Icon name="filters" />Filters{activeCount ? ` (${activeCount})` : ''}</button>
    </div>
    {!!activeCount && <div className={styles.activeFilters}><span className={styles.small}>{activeCount} active {activeCount === 1 ? 'filter' : 'filters'}</span><button className={styles.quiet} onClick={clear} type="button">Clear all ×</button></div>}
    <div className={styles.resultRow}>
      <p className={styles.small} role="status" aria-live="polite">{filtered.length ? `${Math.min(shown, filtered.length)} of ${filtered.length.toLocaleString('en-US')} hackers` : 'No matching hackers'}</p>
      <div className={styles.inlineActions}><div className={styles.sort}><span className={styles.desktopOnly}>Sort by</span><SelectControl label="Sort hackers" value={sort} onValueChange={value => change('sort', value)} options={[{value:'recommended',label:'Suggested for you'},{value:'recent',label:'Recently confirmed'},{value:'name',label:'Name'}]} /></div><button type="button" className={`${styles.secondary} ${styles.mobileOnly}`} onClick={() => setFiltersOpen(true)}><Icon name="filters" />Filters{activeCount ? ` (${activeCount})` : ''}</button></div>
    </div>
    {feedback && <p role={feedback.ok ? 'status' : 'alert'} className={styles.feedback}>{feedback.message}</p>}
    {visible.length ? <ul className={`${styles.grid} ${styles.peopleGrid}`}>{visible.map(profile => <li className="flex min-w-0" key={profile.id}><ProfileCard profile={profile}
      saved={marks.get(profile.id)?.saved} disabled={pending}
      reasons={sort === 'recommended' ? matchReasons(own, profile) : []}
      onSave={upgraded ? () => mutate(() => updateBookmark(profile.id, !marks.get(profile.id)?.saved)) : undefined} /></li>)}</ul> :
      <div className={styles.empty}><span aria-hidden="true">✦</span><h3>{activeCount ? 'Your people might be one filter away.' : savedOnly ? 'Make room for a few great possibilities.' : 'A great team could start with you.'}</h3>
        <p>{activeCount ? 'Try another skill or widen your search. Your next teammate could be from any school.' : savedOnly ? 'Save profiles as you browse. They will appear here while those hackers are discoverable.' : 'No other hackers are listed yet. Make yourself discoverable and check back as people join.'}</p>
        {activeCount ? <button className={styles.secondary} type="button" onClick={clear}>Show all hackers</button> : savedOnly ? <button className={styles.secondary} type="button" onClick={() => updateTeamQuery({ view: null })}>Explore hackers</button> : null}
      </div>}
    {shown < filtered.length && <div className={styles.loadMore}><button type="button" className={styles.secondary} onClick={() => updateTeamQuery({ shown: String(shown + 9) }, false)}>Show {nextBatch} more {nextBatch === 1 ? 'hacker' : 'hackers'} ↓</button><span className={styles.small}>Keep exploring at your own pace.</span></div>}
    {filtersOpen && <Modal title="Find your kind of team" onClose={() => setFiltersOpen(false)}><div className={styles.form}>
      <div className={styles.formGrid}>
        <label>Role<SelectControl label="Role" value={role} onValueChange={value => change('role', value)} options={[{value:'',label:'Any role'},...TEAM_ROLES.map(value=>({value,label:value}))]} /></label>
        <label>Interest<SelectControl label="Interest" value={interest} onValueChange={value => change('interest', value)} options={[{value:'',label:'Any interest'},...interests.map(value=>({value,label:value}))]} /></label>
        <label>Goal<SelectControl label="Goal" value={goal} onValueChange={value => change('goal', value)} options={[{value:'',label:'Any goal'},...Object.entries(TEAM_GOALS).map(([value,label])=>({value,label}))]} /></label>
        <label>School<SelectControl label="School" value={school} onValueChange={value => change('school', value)} options={[{value:'',label:'All schools'},...schools]} /></label>
      </div>
      <label className={styles.checkLabel}><input type="checkbox" checked={first} onChange={e => change('first', e.target.checked ? '1' : '')} />First-time hackers</label>
      <label className={styles.checkLabel}><input type="checkbox" checked={github} onChange={e => change('github', e.target.checked ? '1' : '')} />Has a GitHub profile (optional)</label>
      <div className={styles.inlineActions}><button className={styles.primary} type="button" onClick={() => setFiltersOpen(false)}>Show {filtered.length} {filtered.length === 1 ? 'hacker' : 'hackers'}</button><button type="button" className={styles.quiet} onClick={clear}>Reset filters</button></div>
    </div></Modal>}
  </section>;
}
