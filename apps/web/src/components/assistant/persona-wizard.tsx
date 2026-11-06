import {
  DEFAULT_PERSONA,
  MAX_PERSONA_CALL_ME,
  MAX_PERSONA_NOTES,
  PERSONA_LANGUAGES,
  PERSONA_STYLES,
  PERSONA_VOICES,
} from '@agent-office/shared';
import type { AssistantPersona } from '@agent-office/shared';
import { useId, useState } from 'react';
import { setPersona, usePersona } from '../../lib/persona';
import { CopiedIcon } from '../icons';
import { Button } from '../ui/button';
import { ChoiceCards } from '../ui/choice-cards';
import { ColorSwatches } from '../ui/color-swatches';
import { Field } from '../ui/field';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Tabs } from '../ui/tabs';
import { Textarea } from '../ui/textarea';
import { Wizard } from '../ui/wizard';
import { MonAvatar } from './mon-avatar';
import { LANGUAGE_LABEL, STYLE_META, VOICE_LABEL, greeting } from './persona-text';
import styles from './persona-wizard.module.css';

const same = (a: AssistantPersona, b: AssistantPersona): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/** How MON MANG sounds, as a bubble in the chat. */
function Preview({ persona }: { readonly persona: AssistantPersona }) {
  return (
    <div className={styles.preview}>
      <MonAvatar color={persona.color} size={36} />
      <div className={styles.bubble}>
        <span className={styles.name}>MON MANG</span>
        <p>{greeting(persona)}</p>
      </div>
    </div>
  );
}

/**
 * MON MANG's personality in steps: who it is, how it talks, its color, then a look at how
 * it will greet you. Every step can be opened, since there is always a personality to edit.
 */
export function PersonaWizard() {
  const saved = usePersona();
  const [draft, setDraft] = useState<AssistantPersona>(saved);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const id = useId();
  const change = (patch: Partial<AssistantPersona>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setSavedAt(null);
  };
  const unchanged = same(draft, saved);

  return (
    <Wizard
      free
      header={<Preview persona={draft} />}
      steps={[
        {
          id: 'style',
          title: 'Personality',
          hint: 'Who MON MANG is when it talks to you.',
          blocker:
            draft.style === 'custom' && draft.notes === ''
              ? 'Describe the personality you want.'
              : null,
          content: (
            <>
              <ChoiceCards
                label="Personality"
                value={draft.style}
                onChange={(style) => {
                  change({ style });
                }}
                options={PERSONA_STYLES.map((style) => ({
                  value: style,
                  label: `${STYLE_META[style].label} · ${STYLE_META[style].thai}`,
                  hint: STYLE_META[style].hint,
                  icon: STYLE_META[style].emoji,
                }))}
              />
              <Field
                id={`${id}-notes`}
                label={draft.style === 'custom' ? 'Describe MON MANG' : 'Anything else (optional)'}
                hint={`For example: “เหมือนพี่ที่ทำงานใจดี ชอบให้กำลังใจ” or “answer like a pirate”. ${String(MAX_PERSONA_NOTES - draft.notes.length)} characters left.`}
              >
                <Textarea
                  id={`${id}-notes`}
                  value={draft.notes}
                  rows={3}
                  maxLength={MAX_PERSONA_NOTES}
                  placeholder="How it should sound, what it should care about…"
                  onChange={(e) => {
                    change({ notes: e.target.value });
                  }}
                />
              </Field>
            </>
          ),
        },
        {
          id: 'voice',
          title: 'Voice',
          hint: 'How it speaks: its Thai ending, the language and what it calls you.',
          content: (
            <div className={styles.fields}>
              <Field label="Ending">
                <Tabs
                  label="Ending"
                  value={draft.voice}
                  onChange={(voice) => {
                    change({ voice });
                  }}
                  options={PERSONA_VOICES.map((voice) => ({
                    value: voice,
                    label: VOICE_LABEL[voice],
                  }))}
                />
              </Field>
              <Field label="Language">
                <Tabs
                  label="Language"
                  value={draft.language}
                  onChange={(language) => {
                    change({ language });
                  }}
                  options={PERSONA_LANGUAGES.map((language) => ({
                    value: language,
                    label: LANGUAGE_LABEL[language],
                  }))}
                />
              </Field>
              <Field
                id={`${id}-call`}
                label="It calls you"
                hint="บอส, พี่, your name… Leave empty for nothing in particular."
              >
                <Input
                  id={`${id}-call`}
                  value={draft.callMe}
                  maxLength={MAX_PERSONA_CALL_ME}
                  placeholder="บอส"
                  onChange={(e) => {
                    change({ callMe: e.target.value });
                  }}
                />
              </Field>
              <label className={styles.switchRow} htmlFor={`${id}-emoji`}>
                <span>
                  <strong>Emoji</strong>
                  <span>A few fitting emoji in its answers</span>
                </span>
                <Switch
                  id={`${id}-emoji`}
                  checked={draft.emoji}
                  onChange={(emoji) => {
                    change({ emoji });
                  }}
                />
              </label>
            </div>
          ),
        },
        {
          id: 'look',
          title: 'Look',
          hint: 'Its color in the chat and the sidebar.',
          content: (
            <Field id={`${id}-color`} label="Color">
              <ColorSwatches
                id={`${id}-color`}
                label="Color"
                value={draft.color}
                onChange={(color) => {
                  change({ color });
                }}
              />
            </Field>
          ),
        },
        {
          id: 'review',
          title: 'Review',
          hint: 'This is how MON MANG greets you. Save to use it from your next message.',
          content: (
            <dl className={styles.summary}>
              <div>
                <dt>Personality</dt>
                <dd>
                  {STYLE_META[draft.style].label} · {STYLE_META[draft.style].thai}
                </dd>
              </div>
              <div>
                <dt>Ending</dt>
                <dd>{VOICE_LABEL[draft.voice]}</dd>
              </div>
              <div>
                <dt>Language</dt>
                <dd>{LANGUAGE_LABEL[draft.language]}</dd>
              </div>
              <div>
                <dt>Calls you</dt>
                <dd>{draft.callMe === '' ? '—' : draft.callMe}</dd>
              </div>
              <div>
                <dt>Emoji</dt>
                <dd>{draft.emoji ? 'Yes' : 'No'}</dd>
              </div>
              {draft.notes !== '' && (
                <div>
                  <dt>Also</dt>
                  <dd>{draft.notes}</dd>
                </div>
              )}
            </dl>
          ),
        },
      ]}
      finishLabel="Save"
      finishIcon={<CopiedIcon size={16} />}
      finishDisabled={unchanged}
      onFinish={() => {
        setDraft(setPersona(draft));
        setSavedAt(Date.now());
      }}
      secondary={
        <Button
          variant="ghost"
          disabled={same(draft, DEFAULT_PERSONA)}
          onClick={() => {
            change(DEFAULT_PERSONA);
          }}
        >
          Reset
        </Button>
      }
      status={
        savedAt !== null && unchanged
          ? 'Saved. MON MANG talks like this from now on.'
          : unchanged
            ? undefined
            : 'Not saved yet'
      }
    />
  );
}
