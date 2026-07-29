export const MOTIVATIONAL_QUOTES = [
  {
    text: 'The only bad workout is the one that did not happen.',
    author: 'Unknown',
  },
  {
    text: 'Strength does not come from what you can do. It comes from overcoming the things you thought you could not.',
    author: 'Rikki Rogers',
  },
  {
    text: 'Push yourself, because no one else is going to do it for you.',
    author: 'Unknown',
  },
  {
    text: 'Success is the sum of small efforts repeated day in and day out.',
    author: 'Robert Collier',
  },
  {
    text: 'Your body can stand almost anything. It is your mind you have to convince.',
    author: 'Unknown',
  },
  {
    text: 'Discipline is choosing between what you want now and what you want most.',
    author: 'Abraham Lincoln',
  },
  {
    text: 'Do not count the days. Make the days count.',
    author: 'Muhammad Ali',
  },
  {
    text: 'The pain you feel today will be the strength you feel tomorrow.',
    author: 'Unknown',
  },
  {
    text: 'A one-hour workout is 4% of your day. No excuses.',
    author: 'Unknown',
  },
  {
    text: 'Motivation gets you started. Habit keeps you going.',
    author: 'Jim Ryun',
  },
  {
    text: 'Fall in love with taking care of yourself.',
    author: 'Unknown',
  },
  {
    text: 'Small progress is still progress.',
    author: 'Unknown',
  },
] as const;

function hashDateString(dateKey: string): number {
  let hash = 0;
  for (let index = 0; index < dateKey.length; index += 1) {
    hash = (hash * 31 + dateKey.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function getDailyMotivationalQuote(date = new Date()) {
  const dateKey = date.toISOString().slice(0, 10);
  const index = hashDateString(dateKey) % MOTIVATIONAL_QUOTES.length;
  return MOTIVATIONAL_QUOTES[index];
}
