import { LETTER_POINTS, shuffle, wordScore } from './utils';

const TWO_LETTER_WORDS = [
  'AD', 'AM', 'AN', 'AS', 'AT', 'AX', 'AY', 'BE', 'BY', 'DO', 'ED', 'GO', 'HE', 'HI', 'IF', 'IN', 'IS',
  'IT', 'ME', 'MY', 'NO', 'OF', 'OH', 'ON', 'OR', 'OX', 'SO', 'TO', 'UP', 'US', 'WE',
];

const THREE_LETTER_WORDS = [
  'ACE', 'ACT', 'ADD', 'AGE', 'AIR', 'ANT', 'ANY', 'APE', 'ARC', 'ARE', 'ARM', 'ART', 'ASH', 'ASK', 'ATE',
  'BAD', 'BAG', 'BAR', 'BAT', 'BAY', 'BED', 'BEE', 'BIG', 'BIN', 'BIT', 'BOG', 'BOW', 'BOX', 'BOY', 'BUG',
  'BUS', 'BUT', 'CAN', 'CAP', 'CAR', 'CAT', 'COW', 'COY', 'CRY', 'CUP', 'CUT', 'DAY', 'DEN', 'DOG', 'DOT',
  'DRY', 'DUE', 'EAR', 'EAT', 'EGG', 'END', 'ERA', 'FAN', 'FAR', 'FAT', 'FED', 'FEW', 'FIG', 'FIN', 'FIT',
  'FLY', 'FOG', 'FOX', 'FUN', 'GAP', 'GAS', 'GEM', 'GET', 'GIN', 'GUM', 'GUN', 'HAT', 'HEN', 'HER', 'HIP',
  'HIT', 'HOT', 'HUG', 'HUT', 'ICE', 'INK', 'INN', 'JAM', 'JAR', 'JET', 'JOB', 'JOY', 'KEY', 'KID', 'KIT',
  'LAB', 'LAG', 'LAP', 'LAW', 'LAY', 'LEG', 'LID', 'LIE', 'LIP', 'LOG', 'MAN', 'MAP', 'MAT', 'MAY', 'MIX',
  'NET', 'NEW', 'NOD', 'NOR', 'NOT', 'OAK', 'OAR', 'ODD', 'OFF', 'OIL', 'OLD', 'ONE', 'ORB', 'OWL', 'OWN',
  'PAN', 'PEN', 'PET', 'PIE', 'PIN', 'PIT', 'POT', 'RAM', 'RAN', 'RED', 'RID', 'RIM', 'RIP', 'ROW', 'RUG',
  'RUN', 'RYE', 'SAD', 'SAY', 'SEA', 'SEE', 'SET', 'SHE', 'SHY', 'SIP', 'SIT', 'SKY', 'SUN', 'TAN', 'TAP',
  'TAR', 'TEA', 'TEN', 'TIE', 'TIN', 'TOP', 'TOY', 'TRY', 'TUB', 'USE', 'VAN', 'WAR', 'WAX', 'WAY', 'WEB',
  'WHO', 'WHY', 'WIN', 'YAK', 'YAM', 'YEP', 'YES', 'YET', 'ZIP', 'ZOO',
];

const CORE_WORDS = [
  'ABLE', 'ACID', 'AGED', 'ALSO', 'AREA', 'ARMY', 'AWAY', 'BABY', 'BACK', 'BALL', 'BAND', 'BANK', 'BASE',
  'BATH', 'BEAR', 'BEAT', 'BEEN', 'BEER', 'BELL', 'BELT', 'BEST', 'BILL', 'BIRD', 'BLOW', 'BLUE', 'BOAT',
  'BODY', 'BOMB', 'BOND', 'BONE', 'BOOK', 'BOOM', 'BORN', 'BOSS', 'BOTH', 'BOWL', 'BULK', 'BURN', 'BUSH',
  'BUSY', 'CALL', 'CALM', 'CAME', 'CAMP', 'CARD', 'CARE', 'CASE', 'CASH', 'CAST', 'CELL', 'CHAT', 'CHIP',
  'CITY', 'CLUB', 'COAL', 'COAT', 'CODE', 'COLD', 'COME', 'COOK', 'COOL', 'COPE', 'COPY', 'CORE', 'COST',
  'CREW', 'CROP', 'DARK', 'DATA', 'DATE', 'DAWN', 'DAYS', 'DEAD', 'DEAL', 'DEAN', 'DEAR', 'DEBT', 'DEEP',
  'DENY', 'DESK', 'DIAL', 'DIET', 'DISC', 'DISK', 'DOES', 'DONE', 'DOOR', 'DOSE', 'DOWN', 'DRAW', 'DREW',
  'DROP', 'DRUG', 'DUAL', 'DUKE', 'DUST', 'DUTY', 'EACH', 'EARN', 'EASE', 'EAST', 'EASY', 'EDGE', 'ELSE',
  'EVEN', 'EVER', 'EVIL', 'EXIT', 'FACE', 'FACT', 'FAIL', 'FAIR', 'FALL', 'FARM', 'FAST', 'FATE', 'FEAR',
  'FEED', 'FEEL', 'FEET', 'FELL', 'FELT', 'FILE', 'FILL', 'FILM', 'FIND', 'FINE', 'FIRE', 'FIRM', 'FISH',
  'FIVE', 'FLAT', 'FLOW', 'FOOD', 'FOOT', 'FORD', 'FORM', 'FORT', 'FOUR', 'FREE', 'FROM', 'FUEL', 'FULL',
  'FUND', 'GAIN', 'GAME', 'GATE', 'GAVE', 'GEAR', 'GENE', 'GIFT', 'GIRL', 'GIVE', 'GLAD', 'GOAL', 'GOES',
  'GOLD', 'GOLF', 'GONE', 'GOOD', 'GRAY', 'GREW', 'GREY', 'GROW', 'GULF', 'HAIR', 'HALL', 'HAND', 'HANG',
  'HARD', 'HARM', 'HATE', 'HAVE', 'HEAD', 'HEAR', 'HEAT', 'HELD', 'HELL', 'HELP', 'HERE', 'HERO', 'HIGH',
  'HILL', 'HIRE', 'HOLD', 'HOLY', 'HOME', 'HOPE', 'HOST', 'HOUR', 'HUGE', 'HUNG', 'HUNT', 'HURT', 'IDEA',
  'INCH', 'INTO', 'IRON', 'ITEM', 'JAIL', 'JOIN', 'JOKE', 'JUDGE', 'JUMP', 'JUST', 'KEEN', 'KEEP', 'KENT',
  'KEPT', 'KICK', 'KILL', 'KIND', 'KING', 'KNEE', 'KNEW', 'KNIT', 'KNOW', 'LACK', 'LADY', 'LAND', 'LAST',
  'LATE', 'LEAD', 'LEFT', 'LESS', 'LIFE', 'LIFT', 'LIKE', 'LINE', 'LINK', 'LIST', 'LIVE', 'LOAD', 'LOAN',
  'LOCK', 'LOGO', 'LONG', 'LOOK', 'LORD', 'LOSE', 'LOSS', 'LOST', 'LOVE', 'LUCK', 'MADE', 'MAIL', 'MAIN',
  'MAKE', 'MALE', 'MANY', 'MARK', 'MASS', 'MATE', 'MATH', 'MEAL', 'MEAN', 'MEAT', 'MEET', 'MENU', 'MIKE',
  'MILE', 'MILK', 'MILL', 'MIND', 'MINE', 'MISS', 'MODE', 'MOOD', 'MOON', 'MORE', 'MOST', 'MOVE', 'MUCH',
  'MUST', 'NAME', 'NAVY', 'NEAR', 'NECK', 'NEED', 'NEWS', 'NEXT', 'NICE', 'NICK', 'NINE', 'NONE', 'NOON',
  'NOSE', 'NOTE', 'OKAY', 'ONCE', 'ONLY', 'ONTO', 'OPEN', 'ORAL', 'OVER', 'PACE', 'PACK', 'PAGE', 'PAID',
  'PAIN', 'PAIR', 'PALM', 'PARK', 'PART', 'PASS', 'PAST', 'PATH', 'PEAK', 'PICK', 'PINK', 'PIPE', 'PLAN',
  'PLAY', 'PLOT', 'PLUG', 'PLUS', 'POLL', 'POOL', 'POOR', 'PORT', 'POST', 'PULL', 'PURE', 'PUSH', 'RACE',
  'RAIL', 'RAIN', 'RANK', 'RARE', 'RATE', 'READ', 'REAL', 'REAR', 'RELY', 'RENT', 'REST', 'RICE', 'RICH',
  'RIDE', 'RING', 'RISE', 'RISK', 'ROAD', 'ROCK', 'ROLE', 'ROLL', 'ROOF', 'ROOM', 'ROOT', 'ROSE', 'RULE',
  'RUSH', 'RUTH', 'SAFE', 'SAID', 'SAKE', 'SALE', 'SALT', 'SAME', 'SAND', 'SAVE', 'SEAT', 'SEED', 'SEEK',
  'SEEM', 'SEEN', 'SELF', 'SELL', 'SEND', 'SENT', 'SEPT', 'SHIP', 'SHOP', 'SHOT', 'SHOW', 'SHUT', 'SICK',
  'SIDE', 'SIGN', 'SILK', 'SING', 'SINK', 'SITE', 'SIZE', 'SKIN', 'SLIP', 'SLOW', 'SNOW', 'SOFT', 'SOIL',
  'SOLD', 'SOLE', 'SOME', 'SONG', 'SOON', 'SORT', 'SOUL', 'SPOT', 'STAR', 'STAY', 'STEP', 'STOP', 'SUCH',
  'SUIT', 'SURE', 'TAKE', 'TALE', 'TALK', 'TALL', 'TANK', 'TAPE', 'TASK', 'TEAM', 'TECH', 'TELL', 'TEND',
  'TERM', 'TEST', 'TEXT', 'THAN', 'THAT', 'THEM', 'THEN', 'THEY', 'THIN', 'THIS', 'TONE', 'TONY', 'TOOK',
  'TOOL', 'TOUR', 'TOWN', 'TREE', 'TRIP', 'TRUE', 'TUNE', 'TURN', 'TWIN', 'TYPE', 'UNIT', 'UPON', 'USED',
  'USER', 'VARY', 'VAST', 'VERY', 'VICE', 'VIEW', 'VOTE', 'WAGE', 'WAIT', 'WAKE', 'WALK', 'WALL', 'WANT',
  'WARD', 'WARM', 'WASH', 'WAVE', 'WAYS', 'WEAK', 'WEAR', 'WEEK', 'WELL', 'WENT', 'WERE', 'WEST', 'WHAT',
  'WHEN', 'WHOM', 'WIDE', 'WIFE', 'WILD', 'WILL', 'WIND', 'WINE', 'WING', 'WIRE', 'WISE', 'WISH', 'WITH',
  'WOOD', 'WORD', 'WORE', 'WORK', 'YARD', 'YEAH', 'YEAR', 'YOUR', 'ZERO', 'ZONE', 'ALPHA', 'BRAVO',
  'CHAIR', 'DREAM', 'EARTH', 'FLAME', 'GRAPE', 'HEART', 'INPUT', 'JOLLY', 'KNEEL', 'LIGHT', 'MAGIC',
  'NIGHT', 'OCEAN', 'PIANO', 'QUIET', 'RIVER', 'STONE', 'TABLE', 'UNITY', 'VOICE', 'WORLD', 'YOUTH',
  'ZEBRA', 'ORANGE', 'PURPLE', 'SILVER', 'GARDEN', 'PLANET', 'ROCKET', 'CIRCLE', 'BRIDGE', 'SUMMER',
  'WINTER', 'JUNGLE', 'CASTLE',
];

export const WORDLIST = new Set([...TWO_LETTER_WORDS, ...THREE_LETTER_WORDS, ...CORE_WORDS]);

type Tile = {
  id: string;
  letter: string;
  value: number;
};

const SCRABBLE_DISTRIBUTION: Array<[string, number]> = [
  ['A', 9], ['B', 2], ['C', 2], ['D', 4], ['E', 12], ['F', 2], ['G', 3], ['H', 2], ['I', 9], ['J', 1],
  ['K', 1], ['L', 4], ['M', 2], ['N', 6], ['O', 8], ['P', 2], ['Q', 1], ['R', 6], ['S', 4], ['T', 6],
  ['U', 4], ['V', 2], ['W', 2], ['X', 1], ['Y', 2], ['Z', 1],
];

export function buildScrabbleBag() {
  let serial = 0;
  const bag: Tile[] = [];
  for (const [letter, count] of SCRABBLE_DISTRIBUTION) {
    for (let index = 0; index < count; index += 1) {
      bag.push({ id: `tile-${letter}-${serial++}`, letter, value: LETTER_POINTS[letter] || 0 });
    }
  }
  return shuffle(bag);
}

export function drawScrabbleTiles(bag: Tile[], count: number) {
  const nextBag = [...bag];
  const tiles: Tile[] = [];
  for (let index = 0; index < count; index += 1) {
    const nextTile = nextBag.shift();
    if (!nextTile) break;
    tiles.push(nextTile);
  }
  return { bag: nextBag, tiles };
}

export function canSpellFromTiles(word: string, letters: string[]) {
  const pool = [...letters];
  for (const letter of word.toUpperCase()) {
    const tileIndex = pool.indexOf(letter);
    if (tileIndex === -1) return false;
    pool.splice(tileIndex, 1);
  }
  return true;
}

export function localWordValid(word: string) {
  return WORDLIST.has(word.toUpperCase());
}

export function playableRackWords(letters: string[], limit = 8) {
  const normalized = letters.map((letter) => letter.toUpperCase());
  return [...WORDLIST]
    .filter((word) => word.length >= 2 && word.length <= normalized.length && canSpellFromTiles(word, normalized))
    .sort((left, right) => right.length - left.length || wordScore(right) - wordScore(left) || left.localeCompare(right))
    .slice(0, limit);
}

export function drawPlayableScrabbleTiles(bag: Tile[], count: number) {
  const fallback = drawScrabbleTiles(bag, count);
  if (fallback.tiles.length < count || playableRackWords(fallback.tiles.map((tile) => tile.letter), 1).length) {
    return fallback;
  }

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const reshuffledBag = shuffle([...bag]);
    const candidate = drawScrabbleTiles(reshuffledBag, count);
    if (candidate.tiles.length < count || playableRackWords(candidate.tiles.map((tile) => tile.letter), 1).length) {
      return candidate;
    }
  }

  return fallback;
}

export function refillPlayableScrabbleRack(bag: Tile[], rack: Tile[], handSize: number) {
  const needed = Math.max(0, handSize - rack.length);
  if (!needed) {
    return { bag, rack };
  }

  const fallback = drawScrabbleTiles(bag, needed);
  const fallbackRack = [...rack, ...fallback.tiles];
  if (fallback.tiles.length < needed || playableRackWords(fallbackRack.map((tile) => tile.letter), 1).length) {
    return { bag: fallback.bag, rack: fallbackRack };
  }

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const reshuffledBag = shuffle([...bag]);
    const candidate = drawScrabbleTiles(reshuffledBag, needed);
    const candidateRack = [...rack, ...candidate.tiles];
    if (candidate.tiles.length < needed || playableRackWords(candidateRack.map((tile) => tile.letter), 1).length) {
      return { bag: candidate.bag, rack: candidateRack };
    }
  }

  return { bag: fallback.bag, rack: fallbackRack };
}

export { wordScore };
