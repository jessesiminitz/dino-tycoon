/** What visitors think about, and what they say about it. */
export type Topic =
  | 'dinos'
  | 'price'
  | 'food'
  | 'drink'
  | 'restroom'
  | 'mess'
  | 'litter'
  | 'weather'
  | 'safety'
  | 'staff'
  | 'scenery'
  | 'shop';

export const TOPICS: Topic[] = ['dinos', 'price', 'food', 'drink', 'restroom', 'mess', 'litter', 'weather', 'safety', 'staff', 'scenery', 'shop'];

/** Details a thought can mention: `{species}`, `{name}`, `{price}`, `{item}`. */
export type ThoughtVars = Partial<Record<'species' | 'name' | 'price' | 'item', string>>;

type Lines = { good: string[]; bad: string[] };

export const THOUGHTS: Record<Topic, Lines> = {
  dinos: {
    good: [
      'Wow, a real {species}!',
      '{name} the {species} looked right at me!',
      'The {species} is even bigger than I imagined.',
      'I could watch {name} all day.',
      'Best {species} I have ever seen. Only one I have ever seen, too!',
    ],
    bad: [
      'Where are all the dinosaurs?',
      "I paid to see dinosaurs and haven't seen a single one.",
      'These paths go nowhere near the animals.',
      'Is this a dinosaur park or a walking trail?',
    ],
  },
  price: {
    good: ['{price} to get in? What a bargain!', 'Great value for {price}.'],
    bad: ['{price} for a ticket? That is steep for what is here.', 'Way overpriced at {price}.', 'I want my {price} back.'],
  },
  food: {
    good: ['Mmm, that {item} hit the spot.', 'Tasty {item}!', 'Good food here.'],
    bad: ["I'm starving and there's nowhere to eat.", 'Why is there no food in this park?', 'My stomach is growling.'],
  },
  drink: {
    good: ['Ahh, an ice-cold soda!', 'Just what I needed on a hot day.'],
    bad: ["I'm so thirsty. Is there anywhere to buy a drink?", 'Parched! Not a drink stand in sight.'],
  },
  restroom: {
    good: ['Phew, found the restrooms just in time.', 'Clean restrooms, nice.'],
    bad: [
      'Is there a restroom anywhere?!',
      'I really need a bathroom...',
      'The restrooms are way too far away.',
    ],
  },
  mess: {
    good: [],
    bad: ['Ew! Someone had an accident right on the path.', 'Gross, what is that smell?', "Nobody's cleaning this up?"],
  },
  litter: {
    good: ['The paths are so clean here.'],
    bad: ['There is trash everywhere.', 'Why are there no trash cans?', 'I nearly slipped on a soda cup.'],
  },
  weather: {
    good: ['Glad I bought this {item}!', 'Nice and dry under my {item}.'],
    bad: ["I'm soaked to the bone.", 'This rain is ruining my day.'],
  },
  safety: {
    good: [],
    bad: ['A dinosaur is loose! Run!', 'That {species} is out of its paddock!', 'I do not feel safe here.'],
  },
  staff: {
    good: ['The staff here are great.'],
    bad: [],
  },
  scenery: {
    good: ['What a lovely garden.', 'The fountains and flowers are beautiful.', 'Nice spot to sit and relax.'],
    bad: [],
  },
  shop: {
    good: ['I got a {item}!', 'Love my new {item}.'],
    bad: [],
  },
};

/** What to do about each kind of complaint, for the "what visitors are saying" summary. */
export const ADVICE: Record<Topic, string> = {
  dinos: 'Run paths close to your paddocks, and add more animals.',
  price: 'Lower the ticket price, or give visitors more to see.',
  food: 'Build restaurants or snack stalls along busy paths.',
  drink: 'Snack stalls sell sodas; spread a few around the park.',
  restroom: 'Build restrooms beside the paths, especially near food.',
  mess: 'Build restrooms so there are no accidents, and hire janitors.',
  litter: 'Put trash cans by the paths (near food most of all) and hire janitors.',
  weather: 'A souvenir shop sells ponchos and umbrellas on rainy days.',
  safety: 'Build stronger fences and hire guards.',
  staff: '',
  scenery: 'Plant gardens along the paths.',
  shop: 'Build a souvenir shop.',
};

export const TOPIC_LABELS: Record<Topic, string> = {
  dinos: 'Dinosaurs',
  price: 'Ticket price',
  food: 'Food',
  drink: 'Drinks',
  restroom: 'Restrooms',
  mess: 'Mess',
  litter: 'Litter',
  weather: 'Weather',
  safety: 'Safety',
  staff: 'Staff',
  scenery: 'Gardens',
  shop: 'Souvenirs',
};

export function thoughtText(topic: Topic, good: boolean, vars: ThoughtVars, roll: number): string {
  const lines = THOUGHTS[topic][good ? 'good' : 'bad'];
  // Lines that mention something we don't know are skipped.
  const usable = lines.filter((l) => [...l.matchAll(/\{(\w+)\}/g)].every((m) => vars[m[1] as keyof ThoughtVars]));
  const pick = usable.length ? usable : lines;
  const line = pick[Math.floor(roll * pick.length) % pick.length] ?? '';
  return line.replace(/\{(\w+)\}/g, (_, k: string) => vars[k as keyof ThoughtVars] ?? '');
}

export const VISITOR_FIRST_NAMES = [
  'Maya', 'Leo', 'Ava', 'Noah', 'Zoe', 'Eli', 'Mia', 'Omar', 'Ivy', 'Theo', 'Lena', 'Ravi', 'Nina', 'Jonah', 'Aria',
  'Felix', 'Rosa', 'Hugo', 'Lila', 'Ezra', 'Priya', 'Otto', 'Iris', 'Milo', 'June', 'Kenji', 'Tess', 'Ari', 'Nadia',
  'Luca', 'Grace', 'Sol', 'Freya', 'Diego', 'Ada', 'Max', 'Yara', 'Ben', 'Cleo', 'Sami', 'Ruth', 'Finn', 'Esme', 'Jay',
];

/** A stable name for a visitor, from its id. */
export function visitorName(id: number, roll: number): string {
  const first = VISITOR_FIRST_NAMES[id % VISITOR_FIRST_NAMES.length];
  const initial = String.fromCharCode(65 + Math.floor(roll * 26));
  return `${first} ${initial}.`;
}
