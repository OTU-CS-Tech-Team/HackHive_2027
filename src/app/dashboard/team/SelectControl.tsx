'use client';
import * as Select from '@radix-ui/react-select';
import { useRef, useState } from 'react';
import styles from './team.module.css';

const EMPTY = '__all_options__';
export function SelectControl({ label, options, value, defaultValue = '', onValueChange, name, className = '' }: {
  label: string; options: { value: string; label: string }[]; value?: string; defaultValue?: string;
  onValueChange?: (value: string) => void; name?: string; className?: string;
}) {
  const [selection, setSelection] = useState(defaultValue);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const current = value ?? selection;
  return <><Select.Root value={current || EMPTY} onValueChange={next => {
    const selected = next === EMPTY ? '' : next; setSelection(selected); onValueChange?.(selected);
  }} onOpenChange={open => { if (open) setContainer(trigger.current?.closest('dialog') ?? null); }}>
    <Select.Trigger ref={trigger} type="button" className={`${styles.selectTrigger} ${className}`} aria-label={label}>
      <Select.Value>{options.find(option => option.value === current)?.label ?? current}</Select.Value>
      <Select.Icon className={styles.selectChevron}><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></Select.Icon>
    </Select.Trigger>
    <Select.Portal container={container ?? undefined}><Select.Content position="popper" sideOffset={6} collisionPadding={12} className={styles.selectMenu}>
      <Select.ScrollUpButton className={styles.selectScroll}>⌃</Select.ScrollUpButton>
      <Select.Viewport className={styles.selectViewport}>{options.map(option => <Select.Item key={option.value} value={option.value || EMPTY} className={styles.selectOption}>
        <Select.ItemText>{option.label}</Select.ItemText><Select.ItemIndicator className={styles.selectCheck}>✓</Select.ItemIndicator>
      </Select.Item>)}</Select.Viewport>
      <Select.ScrollDownButton className={styles.selectScroll}>⌄</Select.ScrollDownButton>
    </Select.Content></Select.Portal>
  </Select.Root>{name && <input type="hidden" name={name} value={current} />}</>;
}
