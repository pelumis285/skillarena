export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function money(n: number) {
  return n < 0 ? `-$${Math.abs(n).toFixed(2)}` : `$${n.toFixed(2)}`;
}

export function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime())/1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s/60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h/24);
  return `${d}d ago`;
}

export const LETTER_POINTS: Record<string, number> = {
  A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,K:5,L:1,M:3,N:1,O:1,P:3,
  Q:10,R:1,S:1,T:1,U:1,V:4,W:4,X:8,Y:4,Z:10
};

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i=a.length-1; i>0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const VOWELS = "AEIOU".split('');
const CONSONANTS = "BCDFGHJKLMNPQRSTVWXYZ".split('');

export function generateWordRack() {
  const rack:string[] = [];
  for (let i=0;i<3;i++) rack.push(VOWELS[Math.floor(Math.random()*VOWELS.length)]);
  for (let i=0;i<4;i++) rack.push(CONSONANTS[Math.floor(Math.random()*CONSONANTS.length)]);
  return shuffle(rack);
}

export function wordScore(word: string) {
  const base = word.toUpperCase().split('').reduce((s,c)=> s + (LETTER_POINTS[c]||0),0);
  const lenBonus = word.length >= 6 ? 14 : word.length >=5 ? 6 : 0;
  return base * word.length + lenBonus;
}
