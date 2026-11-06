import type {
  AssistantPersona,
  PersonaLanguage,
  PersonaStyle,
  PersonaVoice,
} from '@agent-office/shared';

export interface StyleMeta {
  readonly label: string;
  /** In Thai, as MON MANG mostly speaks it. */
  readonly thai: string;
  readonly hint: string;
  readonly emoji: string;
}

export const STYLE_META: Readonly<Record<PersonaStyle, StyleMeta>> = {
  buddy: {
    label: 'Buddy',
    thai: 'เพื่อนซี้',
    hint: 'Warm and casual, a light joke now and then',
    emoji: '😄',
  },
  pro: {
    label: 'Professional',
    thai: 'มืออาชีพ',
    hint: 'Polite, precise and organized',
    emoji: '💼',
  },
  cheerful: {
    label: 'Cheerful',
    thai: 'สดใส',
    hint: 'Upbeat and encouraging, celebrates progress',
    emoji: '✨',
  },
  mentor: {
    label: 'Mentor',
    thai: 'พี่เลี้ยง',
    hint: 'Patient, explains why and suggests a next step',
    emoji: '🧭',
  },
  brief: {
    label: 'Brief',
    thai: 'สั้น กระชับ',
    hint: 'The fewest words that answer',
    emoji: '⚡',
  },
  custom: {
    label: 'Your own',
    thai: 'กำหนดเอง',
    hint: 'Describe exactly how it should be',
    emoji: '🎨',
  },
};

export const VOICE_LABEL: Readonly<Record<PersonaVoice, string>> = {
  krub: 'ครับ (ผม)',
  ka: 'ค่ะ (เรา)',
  none: 'No ending (เรา)',
};

export const LANGUAGE_LABEL: Readonly<Record<PersonaLanguage, string>> = {
  auto: 'As you write',
  th: 'Thai',
  en: 'English',
};

/** A line in its voice: the chat's greeting and the preview while you set it up. */
export function greeting(persona: AssistantPersona): string {
  const call = persona.callMe === '' ? '' : ` ${persona.callMe}`;
  const emoji = persona.emoji ? ` ${STYLE_META[persona.style].emoji}` : '';
  if (persona.language === 'en') {
    const name = persona.callMe === '' ? '' : `, ${persona.callMe}`;
    const english: Readonly<Record<PersonaStyle, string>> = {
      buddy: `Hey${name}! What are we getting done today?`,
      pro: `Good to see you${name}. I can start tasks, answer your agents and change settings. Where shall we begin?`,
      cheerful: `Yay, you're back${name}! Ready when you are. What shall we build today?`,
      mentor: `Hi${name}. Tell me what you want to achieve and I'll help you split it up and pick the next step.`,
      brief: 'Ready. Go ahead.',
      custom: `Hi${name}, I'm MON MANG, the way you designed me.`,
    };
    return english[persona.style] + emoji;
  }
  const me = persona.voice === 'krub' ? 'ผม' : 'เรา';
  const end = persona.voice === 'krub' ? 'ครับ' : persona.voice === 'ka' ? 'ค่ะ' : '';
  const ask = persona.voice === 'krub' ? 'ครับ' : persona.voice === 'ka' ? 'คะ' : '';
  const thai: Readonly<Record<PersonaStyle, string>> = {
    buddy: `เฮ้${call} ว่าไง! วันนี้ให้${me}ช่วยอะไรดี${ask}`,
    pro: `สวัสดี${end}${call} ${me}พร้อมดูแลงานของ agents ทุกตัวให้${end} ต้องการเริ่มจากเรื่องใด${ask}`,
    cheerful: `เย้ เจอกันอีกแล้ว${call}! ${me}พร้อมลุยเต็มที่เลย${end} วันนี้ทำอะไรกันดี${ask}`,
    mentor: `สวัสดี${end}${call} บอกเป้าหมายมาได้เลย เดี๋ยว${me}ช่วยแบ่งงานและแนะนำขั้นต่อไปให้${end}`,
    brief: `พร้อม${end} สั่งได้เลย`,
    custom: `สวัสดี${end}${call} ${me}คือ MON MANG ในแบบที่คุณออกแบบเอง${end}`,
  };
  return thai[persona.style] + emoji;
}

/** "Buddy · ครับ (ผม)": the personality in a few words. */
export function personaSummary(persona: AssistantPersona): string {
  return `${STYLE_META[persona.style].label} · ${VOICE_LABEL[persona.voice]}`;
}
