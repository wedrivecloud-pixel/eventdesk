import { emptyDetails, type FormField } from './manage-config';
import type { Resource } from './settings';

export type QuestionnaireSample = {
  id: string;
  name: string;
  description: string;
  fields: FormField[];
  showWhen?: string;
  staffOnly?: boolean;
};
const field = (
  id: string,
  label: string,
  type = 'Text Field',
  extra: Partial<FormField> = {},
): FormField => ({
  id,
  label,
  type,
  hint: '',
  placeholder: '',
  required: false,
  options: [],
  tab: 'General',
  repeat: false,
  timeline: false,
  conditionField: '',
  conditionValue: '',
  ...extra,
});
const yesNo = (id: string, label: string, extra: Partial<FormField> = {}) =>
  field(id, label, 'Radio Buttons', { options: ['Yes', 'No'], ...extra });
const songSuggestions = {
  quiet: [
    'Canon in D — Johann Pachelbel',
    'Clair de lune — Claude Debussy',
    'A Thousand Years — Christina Perri',
  ],
  entrance: [
    'Marry You — Bruno Mars',
    'Signed, Sealed, Delivered — Stevie Wonder',
    'You Make My Dreams — Daryl Hall & John Oates',
  ],
  dance: [
    'At Last — Etta James',
    'Perfect — Ed Sheeran',
    'Can’t Help Falling in Love — Elvis Presley',
  ],
  family: [
    'My Girl — The Temptations',
    'What a Wonderful World — Louis Armstrong',
    'You’ve Got a Friend — James Taylor',
  ],
  party: [
    'September — Earth, Wind & Fire',
    'I Wanna Dance with Somebody — Whitney Houston',
    'Dancing Queen — ABBA',
  ],
  cake: [
    'How Sweet It Is — James Taylor',
    'Sugar — Maroon 5',
    'L-O-V-E — Nat King Cole',
  ],
  last: [
    'Last Dance — Donna Summer',
    'Closing Time — Semisonic',
    'Don’t Stop Believin’ — Journey',
  ],
};
const music = (): FormField[] => [
  field('genres', 'Favorite music genres and artists', 'Text Box', {
    tab: 'Music Preferences',
  }),
  yesNo('requests', 'May we accept guest requests?', {
    tab: 'Music Preferences',
  }),
  yesNo('explicit', 'Are explicit lyrics allowed?', {
    tab: 'Music Preferences',
  }),
  field('music-notes', 'Additional music instructions', 'Text Box', {
    tab: 'Music Preferences',
  }),
  field('must-play', 'Must-play songs', 'Song List', {
    tab: 'Promised Songs',
    hint: 'Enter a song and artist on each line.',
  }),
  field(
    'must-play-playlist',
    'Must-play playlist link',
    'Streaming Service Playlist',
    {
      tab: 'Promised Songs',
      hint: 'Paste a Spotify, Apple Music, or YouTube Music playlist URL.',
    },
  ),
  field('do-not-play', 'Do-not-play songs', 'Song List', {
    tab: 'Do Not Play',
    hint: 'Include songs, artists, or styles to avoid.',
  }),
  field(
    'do-not-play-playlist',
    'Do-not-play playlist link',
    'Streaming Service Playlist',
    { tab: 'Do Not Play' },
  ),
];
type Moment = [string, string, keyof typeof songSuggestions | null];
const ceremony: Moment[] = [
  ['prelude', 'Prelude', 'quiet'],
  ['groom-entrance', 'Groom entrance', 'entrance'],
  ['processional', 'Processional', 'quiet'],
  ['bride-entrance', 'Bride entrance', 'quiet'],
  ['interlude', 'Interlude / special ceremony', 'quiet'],
  ['recessional', 'Recessional', 'entrance'],
];
const reception: Moment[] = [
  ['grand-entrance', 'Grand entrance', 'entrance'],
  ['welcome-toast', 'Welcome toast', null],
  ['first-dance', 'First dance', 'dance'],
  ['dinner', 'Dinner service', 'quiet'],
  ['toasts', 'Speeches and toasts', null],
  ['father-daughter', 'Father / daughter dance', 'family'],
  ['mother-son', 'Mother / son dance', 'family'],
  ['bridal-dance', 'Wedding party dance', 'party'],
  ['anniversary', 'Anniversary dance', 'dance'],
  ['open-dance', 'Open dancing', 'party'],
  ['bouquet', 'Bouquet toss', 'party'],
  ['garter', 'Garter removal / toss', 'party'],
  ['honeymoon', 'Honeymoon dance', 'dance'],
  ['cake', 'Cake cutting', 'cake'],
  ['last-dance', 'Last dance', 'last'],
];
function moments(
  items: Moment[],
  tab: string,
  suggestions: boolean,
): FormField[] {
  return items.flatMap(([id, label, songs]) => [
    field(id, label, songs ? 'Song' : 'Text Field', {
      tab,
      placeholder: songs ? 'Song title — artist' : 'Speaker name and role',
      options: suggestions && songs ? [...songSuggestions[songs]] : [],
    }),
    field(id + '-time', label + ' time', 'Time Field', { tab, timeline: true }),
  ]);
}
function wedding(suggestions: boolean, timelineOnly = false): FormField[] {
  return [
    ...(timelineOnly ? [] : music()),
    ...moments(ceremony, 'Ceremony', suggestions),
    field(
      'custom-ceremony',
      'Additional ceremony songs and traditions',
      'Text Box',
      {
        tab: 'Ceremony',
        hint: 'Include the song, artist, time, and any instructions.',
      },
    ),
    ...(timelineOnly
      ? []
      : [
          field(
            'cocktail-style',
            'Cocktail hour music style',
            'Radio Buttons',
            {
              tab: 'Cocktail Hour',
              options: [
                'Acoustic / soft rock',
                'Jazz / standards',
                'DJ’s choice',
                'Other',
              ],
            },
          ),
          field('cocktail-notes', 'Cocktail hour instructions', 'Text Box', {
            tab: 'Cocktail Hour',
          }),
          field('wedding-party', 'Wedding party introductions', 'Text Box', {
            tab: 'Reception',
            repeat: true,
            hint: 'List each person’s name, role, and pronunciation.',
          }),
        ]),
    ...moments(reception, 'Reception', suggestions),
    field(
      'reception-custom',
      'Additional reception songs and instructions',
      'Text Box',
      {
        tab: 'Reception',
        hint: 'Include the song, artist, time, and any special traditions.',
      },
    ),
  ];
}
const staffFollowup = (id: string, label: string, when: string) => [
  yesNo(id, label, { required: true }),
  field(id + '-explain', label + ' — details', 'Text Box', {
    required: true,
    conditionField: id,
    conditionValue: when,
    hint: 'Describe what happened and any follow-up needed.',
  }),
];
export const planningQuestionnaire: QuestionnaireSample = {
  id: 'planning-questionnaire',
  name: 'Planning Questionnaire',
  description:
    'A concise photo booth questionnaire for setup, power, operating hours, print wording, and your event-day contact.',
  showWhen: 'Always',
  fields: [
    field('setup', 'Where should we set up the photo booth?', 'Text Box', {
      hint: 'Describe the space, distance from parking or unloading, and any stairs or elevators.',
    }),
    field(
      'power',
      'Is a power outlet available within 25 feet of the booth?',
      'Radio Buttons',
      {
        options: ['Yes', 'No', 'Not sure'],
      },
    ),
    field(
      'hours',
      'What time should the booth open and close?',
      'Double Text Field',
      {
        placeholder: 'Booth opens | Booth closes',
        hint: 'Include AM or PM. Booth operating hours may differ from the overall event schedule.',
      },
    ),
    field(
      'print-wording',
      'What names or wording would you like on the prints?',
      'Text Field',
      {
        hint: 'For example, names and an event date, or your company name.',
      },
    ),
    field(
      'on-site-contact',
      'Who can we contact at the venue on the day?',
      'Double Text Field',
      {
        placeholder: 'Name | Mobile number',
        hint: 'Choose someone available during setup, such as a venue coordinator or family member.',
      },
    ),
    field('other', 'What else should our team know?', 'Text Box'),
  ],
};
export const questionnaireSamples: QuestionnaireSample[] = [
  planningQuestionnaire,
  {
    id: 'general-event',
    name: 'General Event Planner',
    description:
      'A short starting point for guest count, event theme, and special requests.',
    fields: [
      field('guests', 'Expected guest count'),
      field('theme', 'Event theme'),
      field('notes', 'Additional event information', 'Text Box'),
    ],
  },
  {
    id: 'model-release',
    name: 'Model Release',
    description:
      'An editable photo-use permission starter with consent and a typed name.',
    fields: [
      field(
        'release-scope',
        'Photo-use permission: describe your business, the photographs covered, and the proposed uses here before sharing this form.',
        'Plain Text',
      ),
      field(
        'consent',
        'Do you consent to the photo uses described above?',
        'Radio Buttons',
        { required: true, options: ['I agree', 'I do not agree'] },
      ),
      field('signature', 'Signature — type your full name', 'Text Field', {
        required: true,
        placeholder: 'Full name',
        hint: 'Your typed name records your response to the permission request above.',
      }),
      field('signature-date', 'Date', 'Date Field', { required: true }),
    ],
  },
  {
    id: 'music-planner',
    name: 'Music Planner',
    description:
      'Music preferences, guest requests, promised songs, do-not-play lists, and playlist links.',
    fields: music(),
  },
  {
    id: 'photo-booth',
    name: 'Photo Booth Detailed Event Planner',
    description:
      'Contacts, design files, operating hours, power, parking, and setup requirements.',
    fields: [
      field('event-heading', 'Event details', 'Header'),
      field('contact', 'Additional on-site contact', 'Triple Text Field', {
        required: true,
        placeholder: 'Name | Mobile number | Role',
        hint: 'Provide a contact we can reach while you are busy.',
      }),
      field('event-purpose', 'Tell us about your celebration', 'Text Box', {
        required: true,
      }),
      field('guests', 'Estimated guest count'),
      field('dress', 'Staff dress code'),
      field('design-heading', 'Design', 'Header'),
      field('theme', 'Colors, theme, and print wording', 'Text Box'),
      field('logo', 'Logo or artwork', 'Image Upload Field'),
      field('invitation', 'Flyer or invitation', 'File Upload Field'),
      field('schedule-heading', 'Schedule', 'Header'),
      field('event-start', 'Event start', 'Time Field'),
      field('event-end', 'Event end', 'Time Field'),
      field('booth-start', 'Photo booth opens', 'Time Field'),
      field('booth-end', 'Photo booth closes', 'Time Field'),
      field('setup-heading', 'Setup', 'Header'),
      field('power', 'Is power available near the booth?', 'Dropdown', {
        required: true,
        options: ['Yes, within 15 feet', 'No power available', 'Not sure'],
      }),
      field('wifi', 'Wi-Fi access details'),
      field('parking', 'Parking and loading instructions', 'Text Box'),
      field('other', 'Additional setup notes', 'Text Box'),
    ],
  },
  {
    id: 'client-survey',
    name: 'Post-Event Client Survey',
    description:
      'Rate the event experience, preparation, and likelihood of recommending your business.',
    showWhen: 'After event',
    fields: [
      ...[
        'Event experience',
        'Planning and communication',
        'Likelihood of recommending us',
      ].map((label, i) =>
        field('rating-' + i, label, 'Radio Buttons', {
          required: true,
          options: [
            '5 — Excellent',
            '4 — Good',
            '3 — Average',
            '2 — Below expectations',
            '1 — Poor',
          ],
        }),
      ),
      field('feedback', 'Additional feedback', 'Text Box'),
    ],
  },
  {
    id: 'staff-notes',
    name: 'Post-Event Staff Notes',
    description:
      'An internal debrief with conditional follow-ups for delays, incidents, equipment, and supplies.',
    showWhen: 'After event',
    staffOnly: true,
    fields: [
      field('overall', 'Overall event summary', 'Text Box'),
      ...staffFollowup('on-time', 'Was arrival and setup on time?', 'No'),
      ...staffFollowup(
        'issues',
        'Were there client, guest, venue, or setup issues?',
        'Yes',
      ),
      ...staffFollowup(
        'equipment',
        'Was equipment damaged, missing, or in need of maintenance?',
        'Yes',
      ),
      ...staffFollowup(
        'supplies',
        'Were all necessary supplies available?',
        'No',
      ),
      field('energy', 'Event flow and energy', 'Radio Buttons', {
        required: true,
        options: ['Excellent', 'Good', 'Fair', 'Poor'],
      }),
      field('improvements', 'Notes and suggestions for next time', 'Text Box'),
    ],
  },
  {
    id: 'wedding-classic',
    name: 'Wedding Planner - Classic',
    description:
      'Six planning tabs covering music, ceremony, cocktail hour, and reception timing.',
    fields: wedding(false),
  },
  {
    id: 'wedding-suggestions',
    name: 'Wedding Planner with Suggestions',
    description:
      'The detailed wedding planner with editable song suggestions for key moments.',
    fields: wedding(true),
  },
  {
    id: 'timeline',
    name: 'Wedding Timeline-Only',
    description:
      'Collect times for key wedding moments without asking for music selections.',
    fields: [
      'Guest arrival',
      'Cocktail hour',
      'Wedding party arrival',
      'Wedding party introductions',
      'First dance',
      'Cake cutting',
      'Dinner',
      'Toasts',
      'Parent dances',
      'Bouquet and garter toss',
      'Last song',
    ].map((label, i) =>
      field('time-' + i, label, 'Time Field', {
        tab: 'Timeline',
        timeline: true,
      }),
    ),
  },
  {
    id: 'timeline-suggestions',
    name: 'Wedding Timeline-Only with Suggestions',
    description:
      'Ceremony and reception times, song suggestions, and speaker details.',
    fields: wedding(true, true),
  },
];

/** Each selection produces an independent, unsaved copy with remapped conditions. */
export function questionnaireFromSample(sample: QuestionnaireSample): Resource {
  const ids = new Map(sample.fields.map((f) => [f.id, crypto.randomUUID()]));
  const fields = sample.fields.map((f) => ({
    ...f,
    id: ids.get(f.id)!,
    options: [...f.options],
    conditionField: f.conditionField ? ids.get(f.conditionField)! : '',
  }));
  return {
    id: '',
    kind: 'questionnaires',
    name: sample.name,
    archived: 0,
    data: {
      body: fields.map((f) => f.label).join('\n'),
      showWhen: sample.showWhen || 'Before event',
      staffView: true,
      staffEdit: true,
      clientView: !sample.staffOnly,
      clientEdit: !sample.staffOnly,
      details: JSON.stringify({
        ...emptyDetails(),
        fields,
        tabs: [...new Set(fields.map((f) => f.tab))],
      }),
    },
  };
}
