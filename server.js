import 'dotenv/config';
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_dev_secret';
const JWT_EXPIRY = '30d';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ── SQLite leaderboard ─────────────────────────────────────────────────────
const db = new Database(path.join(__dirname, 'leaderboard.db'));

// Check if the scores table exists and has UNIQUE(name, mode) in its DDL.
// If not (first run or old schema), drop and recreate cleanly.
{
  const tableRow = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='scores'`).get();
  const needsRecreate = !tableRow || !tableRow.sql.includes('UNIQUE');
  if (needsRecreate) {
    db.exec(`DROP TABLE IF EXISTS scores`);
    db.exec(`
      CREATE TABLE scores (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL DEFAULT 'Guest',
        avatar     TEXT    NOT NULL DEFAULT '🙂',
        mode       TEXT    NOT NULL,
        correct    INTEGER NOT NULL DEFAULT 0,
        wrong      INTEGER NOT NULL DEFAULT 0,
        acc        INTEGER NOT NULL DEFAULT 0,
        created_at TEXT    NOT NULL DEFAULT (datetime('now')),
        UNIQUE(name, mode)
      )
    `);
    console.log('[db] scores table created with UNIQUE(name, mode)');
  } else {
    console.log('[db] scores table OK');
  }
}

const findScore  = db.prepare(`SELECT correct FROM scores WHERE name = ? AND mode = ?`);
const insertScore = db.prepare(`INSERT INTO scores (name, avatar, mode, correct, wrong, acc) VALUES (?, ?, ?, ?, ?, ?)`);
const updateScore = db.prepare(`UPDATE scores SET avatar=?, correct=?, wrong=?, acc=?, created_at=datetime('now') WHERE name=? AND mode=?`);

// ── Users table ────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    avatar        TEXT    NOT NULL DEFAULT '🙂',
    password_hash TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`);
const findUser       = db.prepare(`SELECT * FROM users WHERE LOWER(username) = LOWER(?)`);
const findUserById   = db.prepare(`SELECT * FROM users WHERE id = ?`);
const insertUser     = db.prepare(`INSERT INTO users (username, avatar, password_hash) VALUES (?, ?, ?)`);
const updateAvatar   = db.prepare(`UPDATE users SET avatar = ? WHERE id = ?`);

function makeToken(user) {
  return jwt.sign({ userId: user.id, username: user.username, avatar: user.avatar }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function verifyToken(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

// "All" tab: one row per player — their best score across any mode.
// Avatar is pulled live from users table so it always reflects the latest choice.
const getScores = db.prepare(`
  SELECT s.name, COALESCE(u.avatar, s.avatar) AS avatar, s.mode,
         MAX(s.correct) AS correct, s.acc, MAX(s.created_at) AS created_at
  FROM scores s
  LEFT JOIN users u ON LOWER(u.username) = LOWER(s.name)
  GROUP BY s.name
  ORDER BY correct DESC, s.acc DESC
  LIMIT 50
`);

// Mode tab: one row per player for that mode, avatar from users table.
const getByMode = db.prepare(`
  SELECT s.*, COALESCE(u.avatar, s.avatar) AS avatar
  FROM scores s
  LEFT JOIN users u ON LOWER(u.username) = LOWER(s.name)
  WHERE s.mode = ?
  ORDER BY s.correct DESC, s.acc DESC
  LIMIT 50
`);

// Grade 1–12: bot is ONLY that grade. "Junior" = 11th grade ONLY; never say junior unless grade 11.
const PERSONAS = {
  '1': 'CRITICAL: You are in GRADE 1 (first grade) only. You are 6 or 7 years old—a little kid. You have NEVER graduated from anything. You have NEVER been to college, high school, or middle school. You are in FIRST GRADE. Never say you graduated college, graduated school, or finished school. You are NOT a junior. When asked your grade: first grade or 1st grade. Use simple words: cool, yuck, wow, so fun. Short sentences. Stay in character.',
  '2': 'CRITICAL: You are in GRADE 2 (second grade) only. You are 7 or 8. You are NOT a junior. "Junior" means 11th grade—you are not in 11th grade. Never say junior or junior year. When asked your grade, say: second grade or 2nd grade. Simple words: cool, awesome, so funny. Stay in character.',
  '3': 'CRITICAL: You are in GRADE 3 (third grade) only. You are 8 or 9. You are NOT a junior. "Junior" means 11th grade—you are not in 11th grade. Never say junior or junior year. When asked your grade, say: third grade or 3rd grade. Words like cool, awesome, no way. Stay in character.',
  '4': 'CRITICAL: You are in GRADE 4 (fourth grade) only. You are 9 or 10. You are NOT a junior. "Junior" means 11th grade—you are not in 11th grade. Never say junior or junior year. When asked your grade, say: fourth grade or 4th grade. Some slang: cool, awesome, weird, cringe. Stay in character.',
  '5': 'CRITICAL: You are in GRADE 5 (fifth grade) only. You are 10 or 11. You are NOT a junior. "Junior" means 11th grade—you are not in 11th grade. Never say junior or junior year. When asked your grade, say: fifth grade or 5th grade. Some slang: slay, bruh, no cap, fire, bussin. Stay in character.',
  '6': 'CRITICAL: You are in GRADE 6 (sixth grade) only. You are 11 or 12. You are NOT a junior. "Junior" means 11th grade—you are not in 11th grade. Never say junior or junior year. When asked your grade, say: sixth grade or 6th grade. Middle-school slang: rizz, bussin, slay, no cap, bruh, fire, sus, cringe, skibidi, gyatt, fanum tax. Stay in character.',
  '7': 'CRITICAL: You are in GRADE 7 (seventh grade) only. You are 12 or 13. You are NOT a junior. "Junior" means 11th grade—you are not in 11th grade. Never say junior or junior year. When asked your grade, say: seventh grade or 7th grade. Slang: rizz, bussin, slay, no cap, bruh, fire, sus, mid, cooked, tea, lowkey. Stay in character.',
  '8': 'CRITICAL: You are in GRADE 8 (eighth grade) only. You are 13 or 14. You are NOT a junior. "Junior" means 11th grade—you are not in 11th grade. Never say junior or junior year. When asked your grade, say: eighth grade or 8th grade. Slang: rizz, bussin, slay, no cap, fire, tea, it\'s giving, period, bet, ate. Stay in character.',
  '9': 'CRITICAL: You are in GRADE 9 only. You are a FRESHMAN (9th grade). You are NOT a sophomore, junior, or senior. "Junior" means 11th grade—you are not a junior. Never say junior or junior year. When asked your grade, say: ninth grade or freshman. Slang: lowkey, highkey, rizz, bussin, no cap, slay, period, bet, it\'s giving, ick, fr, ngl. Stay in character.',
  '10': 'CRITICAL: You are in GRADE 10 only. You are a SOPHOMORE (10th grade). You are NOT a freshman, junior, or senior. "Junior" means 11th grade—you are not a junior. Never say junior or junior year. When asked your grade, say: tenth grade or sophomore. Slang: lowkey, highkey, rizz, bussin, no cap, slay, period, bet, it\'s giving, fr, ngl. Stay in character.',
  '11': 'CRITICAL: You are in GRADE 11 only. You are a JUNIOR (11th grade). "Junior" is correct only for you—11th graders are juniors. When asked your grade, say: eleventh grade or junior. You are 16 or 17. Slang: rizz, cap, bussin, lowkey, highkey, period, bet, no cap, slay, it\'s giving, ick, fr, ngl, deadass, mid, based. Stay in character.',
  '12': 'CRITICAL: You are in GRADE 12 only. You are a SENIOR (12th grade). You are NOT a junior. "Junior" means 11th grade—you are not a junior. Never say junior or junior year. When asked your grade, say: twelfth grade or senior. You are 17 or 18. Slang: fr, deadass, ngl, lowkey, highkey, rizz, no cap, slay, period, bet, it\'s giving, mid, based, ion. Stay in character.'
};

// Age (or age range) for each grade—bot should say this when asked their age.
const GRADE_AGES = {
  '1': '6 or 7', '2': '7 or 8', '3': '8 or 9', '4': '9 or 10', '5': '10 or 11',
  '6': '11 or 12', '7': '12 or 13', '8': '13 or 14', '9': '14 or 15', '10': '15 or 16',
  '11': '16 or 17', '12': '17 or 18'
};

app.use(express.json());
app.use(express.static(__dirname));

app.post('/api/chat', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server missing ANTHROPIC_API_KEY. Add it to a .env file.' });
  }

  const body = req.body || {};
  console.log('Request body keys:', Object.keys(body));
  const message = body.message;
  const persona = body.persona || '6';
  const userName = body.userName ?? body.user_name ?? '';
  const text = typeof message === 'string' ? message.trim() : '';
  if (!text) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  const name = String(userName || '').trim();
  if (name) console.log('User name received:', name);
  const gradeNum = String(persona).trim() || '6';
  const age = GRADE_AGES[gradeNum] || GRADE_AGES['6'];
  const g = parseInt(gradeNum, 10) || 6;
  let system = PERSONAS[gradeNum] || PERSONAS['6'];
  // No graduation/college for grades 1–11 (only 12th graders are about to graduate high school; nobody has graduated college).
  const noCollege = g <= 11
    ? `NEVER say you graduated college, graduated school, or finished college. You are in grade ${gradeNum}—you have not graduated anything. You are still in school.\n\n`
    : `You are in 12th grade (senior). You have NOT graduated college—you are still in high school. Never say you graduated college.\n\n`;
  // Lock grade and age. Only grade 11 = junior. When asked age, say it. Keep replies short.
  system = `Keep replies SHORT: 1-4 sentences max. No long paragraphs. Chat like a kid/teen texting—brief and natural.\n\n${noCollege}You are playing a student in GRADE ${gradeNum} ONLY. You are ${age} years old. When someone asks your age, say you are ${age} years old. The number ${gradeNum} is your grade. Do not say you are in any other grade. Only if grade is 11 can you say "junior". If grade is not 11, never say junior.\n\n` + system;
  if (name) {
    system = `The person you are chatting with is named ${name}. Always use their name when you reply (e.g. start your reply with their name).\n\n` + system;
  }

  // Include name and grade in every message. For grade 1-11: never say you graduated college or graduated school.
  const gradeReminder = g <= 11
    ? `You are in grade ${gradeNum}. You have NEVER graduated college or graduated school. Do not say you graduated. `
    : `You are in grade ${gradeNum}. You have not graduated college. `;
  const userContent = name
    ? `[The user's name is ${name}. ${gradeReminder}Never say junior unless grade is 11.]\n\n${text}`
    : `[${gradeReminder}You are in grade ${gradeNum}. Never say junior unless grade is 11.]\n\n${text}`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      system,
      messages: [{ role: 'user', content: userContent }]
    });

    const block = response.content?.find(b => b.type === 'text');
    const reply = block?.text?.trim() || "I didn't get a reply.";
    res.json({ reply });
  } catch (err) {
    console.error(err);
    const msg = err?.message || 'Request to Claude failed.';
    res.status(500).json({ error: msg });
  }
});

// ── Fun Facts: pool + queue system ────────────────────────────────────────
const CATEGORIES = ['science','history','animals','space','food','random'];
const TARGET_POOL  = 100;
const BATCH_SIZE   = 10;

// pool[cat] = all generated facts; queue[cat] = shuffled indices not yet served
const pool  = {};
const queue = {};
const generating = {};
CATEGORIES.forEach(c => { pool[c] = []; queue[c] = []; generating[c] = false; });

const TOPIC_SEEDS = {
  science: ['the human body','electricity','chemistry','gravity','DNA','light','the brain','sound waves','magnetism','photosynthesis','black holes','atoms','vaccines','evolution','deep sea creatures','nuclear energy','the immune system','sleep','the digestive system','genetics','plate tectonics','the periodic table','thermodynamics','viruses','neurons','radioactivity','quantum mechanics','the speed of light','osmosis','carbon dating'],
  history: ['ancient Rome','World War II','ancient Egypt','the Vikings','the Renaissance','the Cold War','ancient China','the French Revolution','the Ottoman Empire','the Silk Road','medieval Europe','ancient Greece','the Aztecs','the American Civil War','the Moon landing','the Black Death','the Byzantine Empire','the Mongol Empire','ancient Mesopotamia','the Industrial Revolution','the Spanish Inquisition','Napoleon Bonaparte','the Salem witch trials','the Crusades','ancient Japan','the Roman Colosseum','Cleopatra','Julius Caesar','the printing press','the transatlantic slave trade'],
  animals: ['dolphins','octopuses','elephants','sharks','penguins','cheetahs','bees','crows','axolotls','mantis shrimp','komodo dragons','tardigrades','honey badgers','platypuses','wolves','hummingbirds','archerfish','pistol shrimp','naked mole rats','mimic octopuses','electric eels','bombardier beetles','pistol shrimp','vampire bats','lyrebirds','pistol shrimp','alpine swifts','leafcutter ants','pistol shrimp','immortal jellyfish'],
  space:   ['Mars','black holes','the Moon','Jupiter','Saturn','neutron stars','the Sun','comets','the ISS','dark matter','Pluto','supernovas','the Milky Way','exoplanets','the Big Bang','Venus','Uranus','Neptune','asteroid belts','white dwarfs','pulsars','quasars','wormholes','the Oort Cloud','solar flares','Europa','Titan','the Voyager probes','gravitational waves','cosmic background radiation'],
  food:    ['chocolate','coffee','spicy food','cheese','bread','sushi','honey','salt','hot dogs','pizza','ice cream','bananas','garlic','wine','chili peppers','wasabi','truffles','vanilla','maple syrup','olive oil','tea','popcorn','fermented foods','MSG','butter','vinegar','cinnamon','blue cheese','sourdough','pineapple'],
  random:  ['the Eiffel Tower','playing cards','fingernails','lightning','the Great Wall','rubber ducks','banknotes','escalators','belly buttons','left-handedness','yawning','laughing','dreams','color perception','the alphabet','hiccups','mirrors','dice','elevators','staplers','vending machines','bubble wrap','Post-it notes','zippers','Velcro','superglue','microwave ovens','traffic lights','sunglasses','umbrellas']
};

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function refillQueue(cat) {
  const indices = pool[cat].map((_, i) => i);
  queue[cat] = shuffle(indices);
}

function dequeue(cat) {
  if (queue[cat].length === 0) refillQueue(cat);
  return pool[cat][queue[cat].pop()];
}

async function generateBatch(cat) {
  if (generating[cat]) return;
  generating[cat] = true;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { generating[cat] = false; return; }

  // Pick BATCH_SIZE distinct topics, never reuse a topic already in the pool
  const usedTopics = new Set(pool[cat].map(f => f._topic));
  const available  = (TOPIC_SEEDS[cat] || TOPIC_SEEDS.random).filter(t => !usedTopics.has(t));
  const seeds      = available.length >= BATCH_SIZE ? available : (TOPIC_SEEDS[cat] || TOPIC_SEEDS.random);
  const half       = BATCH_SIZE / 2;

  // Build a randomly ordered list of true/false assignments, then assign one topic each
  const shuffledTopics     = shuffle([...seeds]).slice(0, BATCH_SIZE);
  const isTrueAssignments  = shuffle([...Array(half).fill(true), ...Array(half).fill(false)]);
  const assignments = shuffledTopics.map((topic, i) => ({ topic, isTrue: isTrueAssignments[i] }));

  const trueOnes  = assignments.filter(a => a.isTrue).map(a => a.topic);
  const falseOnes = assignments.filter(a => !a.isTrue).map(a => a.topic);

  const system = `You are a fact-checker and trivia writer generating content for a "Fact or Fake?" game about the category "${cat}".

ACCURACY IS THE TOP PRIORITY. Only include facts you are highly confident are correct (>95% certainty). If you are unsure about a detail, do not use it — pick a different angle you ARE sure about.

Generate EXACTLY ${BATCH_SIZE} facts total:

TRUE facts (isTrue: true) — statements that are genuinely, verifiably true. Surprising or lesser-known is a bonus, but accuracy comes first. One per topic:
${trueOnes.map((t, i) => `${i + 1}. "${t}"`).join('\n')}

FALSE facts (isTrue: false) — statements that sound plausible but are factually wrong. The explanation MUST state the real, accurate truth clearly. One per topic:
${falseOnes.map((t, i) => `${i + 1}. "${t}"`).join('\n')}

STRICT RULES:
- Every "text" field must be a single, unambiguous declarative sentence.
- For TRUE facts: the explanation confirms why it is true with a concrete detail.
- For FALSE facts: the explanation must clearly state what the actual truth is (not just say "this is false"). Example: if the false statement says "X costs $5", the explanation should say "X actually costs $12."
- Never use hedging language like "approximately", "around", or "roughly" in the fact text — be precise.
- Never invent statistics. If a number appears in a TRUE fact, it must be a well-documented, widely cited figure.
- Return all ${BATCH_SIZE} facts in a RANDOM mixed order (do NOT group true then false).

Respond with ONLY a raw JSON array — no markdown, no extra text:
[
  {
    "text": "<one precise declarative sentence>",
    "isTrue": true or false,
    "category": "${cat}",
    "hint": "<a subtle nudge that doesn't give away the answer>",
    "explanation": "<1-2 sentences: concrete confirmation if true, OR the accurate real truth if false>"
  }
]`;

  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2800,
      system,
      messages: [{ role: 'user', content: 'Generate the mixed facts array now.' }]
    });
    const raw = (resp.content?.find(b => b.type === 'text')?.text || '')
      .trim().replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    const batch = JSON.parse(raw);
    if (Array.isArray(batch)) {
      // Trust Claude's isTrue values (they match our assignments), just tag topics
      batch.forEach((f, i) => { f._topic = shuffledTopics[i] || shuffledTopics[0]; });
      // Extra safety: shuffle the batch itself before adding to pool
      pool[cat].push(...shuffle(batch));
      console.log(`[facts] pool[${cat}] now has ${pool[cat].length} facts`);
    }
  } catch (err) {
    console.error(`[facts] batch error for ${cat}:`, err.message);
  } finally {
    generating[cat] = false;
  }
}

app.post('/api/facts', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY.' });

  const cat  = (req.body?.category || 'random').toLowerCase();
  const hard = !!req.body?.hard;
  if (!CATEGORIES.includes(cat)) return res.status(400).json({ error: 'Unknown category.' });

  // Hard mode: generate a one-off brutal question, don't use the pool
  if (hard) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const mustBeTrue = Math.random() < 0.5;
    const seeds = TOPIC_SEEDS[cat] || TOPIC_SEEDS.random;
    const topic = seeds[Math.floor(Math.random() * seeds.length)];

    const system = `You are a fact-checker writing a hard trivia question. ACCURACY IS MANDATORY — only use facts you are certain are correct.
${mustBeTrue
  ? `Write a TRUE fact about "${topic}" that sounds counterintuitive or surprising — something a well-read person might doubt. It must be verifiably, 100% true. The explanation must confirm the truth with a concrete detail.`
  : `Write a FALSE statement about "${topic}" that sounds like a widely believed fact. The explanation MUST clearly state what the actual truth is — not just say it's false, but give the real correct information.`}

Respond with ONLY raw JSON, no markdown:
{
  "text": "<one precise declarative sentence, no hedging>",
  "isTrue": ${mustBeTrue},
  "category": "${cat}",
  "hint": "<a very subtle nudge — barely helpful>",
  "explanation": "<1-2 sentences: concrete confirmation if true, OR the accurate real answer if false>"
}`;

    try {
      const client = new Anthropic({ apiKey });
      const resp = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 350,
        system,
        messages: [{ role: 'user', content: 'Generate the hard final question now.' }]
      });
      const raw = (resp.content?.find(b => b.type === 'text')?.text || '')
        .trim().replace(/^```json?\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(raw);
      parsed.isTrue = mustBeTrue;
      return res.json(parsed);
    } catch (err) {
      console.error('[hard fact]', err.message);
      // Fall through to pool on error
    }
  }

  // If pool is empty, block until first batch is ready
  if (pool[cat].length === 0) {
    await generateBatch(cat);
    if (pool[cat].length === 0) return res.status(500).json({ error: 'Could not generate facts. Try again.' });
    refillQueue(cat);
  }

  const fact = dequeue(cat);

  // Kick off background generation if pool is below target
  if (pool[cat].length < TARGET_POOL && !generating[cat]) {
    generateBatch(cat);
  }

  res.json(fact);
});

// Pre-warm all category pools on startup
CATEGORIES.forEach(cat => {
  generateBatch(cat).then(() => refillQueue(cat));
});

// ── Fun Facts: chat about the current fact ────────────────────────────────
app.post('/api/facts-chat', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY.' });

  const { message, factContext, history = [] } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Message required.' });

  const system = `You are a helpful assistant built into a "Fact or Fake?" trivia game.
Game state: ${factContext || 'No game state available.'}
Rules:
- Keep replies to 1-2 short sentences. Be direct and conversational.
- You can comment on the score, mode, time left, or anything about the game.
- If the context says the player has NOT answered yet: NEVER say, hint, imply, or suggest whether the fact is true or false. If asked directly, say you can't spoil it.
- If the context says the player HAS already answered: freely discuss the answer and explanation.
- NEVER use bold text or markdown. No filler phrases.`;

  const messages = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message }
  ];

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 100,
      system,
      messages
    });
    const block = response.content?.find(b => b.type === 'text');
    res.json({ reply: block?.text?.trim() || "I'm not sure about that one!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err?.message || 'AI request failed.' });
  }
});

// ── Auth routes ────────────────────────────────────────────────────────────
const BAD_PATTERNS_SRV = [/n[i1]gg+[ae3]r/i,/n[e3]gg[ae3]r/i,/n[i1]g[e3]r/i,/sh[i1]t/i,/f+u+c+k?/i,/b[i1]tch/i,/sl+u+t/i,/h[o0]e/i,/slt/i];
function isBadWordSrv(s){ return BAD_PATTERNS_SRV.some(r => r.test(s)); }

app.post('/api/auth/register', async (req, res) => {
  const { username, password, avatar } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });
  const u = String(username).trim().slice(0, 25);
  if (u.length < 2)          return res.status(400).json({ error: 'Username must be at least 2 characters.' });
  if (isBadWordSrv(u))       return res.status(400).json({ error: 'Invalid username.' });
  if (String(password).length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters.' });
  if (findUser.get(u))       return res.status(409).json({ error: 'Username already taken.' });
  try {
    const hash = await bcrypt.hash(String(password), 10);
    const av = String(avatar || '🙂').slice(0, 8);
    const info = insertUser.run(u, av, hash);
    const user = findUserById.get(info.lastInsertRowid);
    res.json({ token: makeToken(user), username: user.username, avatar: user.avatar });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });
  const user = findUser.get(String(username).trim());
  if (!user) return res.status(401).json({ error: 'Incorrect username or password.' });
  const match = await bcrypt.compare(String(password), user.password_hash);
  if (!match) return res.status(401).json({ error: 'Incorrect username or password.' });
  res.json({ token: makeToken(user), username: user.username, avatar: user.avatar });
});

app.get('/api/auth/me', (req, res) => {
  const payload = verifyToken(req);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token.' });
  const user = findUserById.get(payload.userId);
  if (!user) return res.status(401).json({ error: 'User not found.' });
  res.json({ username: user.username, avatar: user.avatar });
});

app.patch('/api/auth/avatar', (req, res) => {
  const payload = verifyToken(req);
  if (!payload) return res.status(401).json({ error: 'Not authenticated.' });
  const { avatar } = req.body || {};
  const av = String(avatar || '🙂').slice(0, 8);
  updateAvatar.run(av, payload.userId);
  // Keep scores table in sync so leaderboard shows the new avatar
  db.prepare(`UPDATE scores SET avatar = ? WHERE name = ?`).run(av, payload.username);
  const user = findUserById.get(payload.userId);
  res.json({ token: makeToken(user), username: user.username, avatar: user.avatar });
});

// ── Leaderboard routes ─────────────────────────────────────────────────────
app.get('/api/check-username', (req, res) => {
  const name = String(req.query.name || '').trim();
  if (!name) return res.json({ taken: false });
  const row = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE LOWER(username) = LOWER(?)`).get(name);
  res.json({ taken: row.n > 0 });
});

app.post('/api/leaderboard/save', (req, res) => {
  const payload = verifyToken(req);
  if (!payload) return res.status(401).json({ error: 'Not authenticated.' });

  const user = findUserById.get(payload.userId);
  if (!user) return res.status(401).json({ error: 'User not found.' });

  const { mode, correct, wrong, acc } = req.body || {};
  if (!mode) return res.status(400).json({ error: 'mode required' });
  try {
    const n   = user.username;
    const av  = user.avatar;
    const md  = String(mode);
    const cor = Number(correct) || 0;
    const wrn = Number(wrong)   || 0;
    const ac  = Number(acc)     || 0;

    const existing = findScore.get(n, md);
    if (!existing) {
      insertScore.run(n, av, md, cor, wrn, ac);
      console.log(`[lb] new score: ${n} / ${md} = ${cor}`);
    } else if (cor > existing.correct) {
      updateScore.run(av, cor, wrn, ac, n, md);
      console.log(`[lb] updated: ${n} / ${md} = ${cor} (was ${existing.correct})`);
    } else {
      console.log(`[lb] no update: ${n} / ${md} new=${cor} existing=${existing.correct}`);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/leaderboard', (req, res) => {
  try {
    const mode = req.query.mode;
    const rows = (mode && mode !== 'all') ? getByMode.all(mode) : getScores.all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Open http://localhost:${PORT}/facts.html for the Fun Facts game!`);
});
