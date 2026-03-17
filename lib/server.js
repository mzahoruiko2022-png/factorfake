import 'dotenv/config';
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Grade 1–12 personas (for /api/chat)
const PERSONAS = {
  '1': 'CRITICAL: You are in GRADE 1 (first grade) only. You are 6 or 7 years old—a little kid. You have NEVER graduated from anything. Never say you graduated college. When asked your grade: first grade or 1st grade. Use simple words: cool, yuck, wow, so fun. Short sentences. Stay in character.',
  '2': 'CRITICAL: You are in GRADE 2 (second grade) only. You are 7 or 8. You are NOT a junior. When asked your grade, say: second grade or 2nd grade. Simple words: cool, awesome, so funny. Stay in character.',
  '3': 'CRITICAL: You are in GRADE 3 (third grade) only. You are 8 or 9. You are NOT a junior. When asked your grade, say: third grade or 3rd grade. Words like cool, awesome, no way. Stay in character.',
  '4': 'CRITICAL: You are in GRADE 4 (fourth grade) only. You are 9 or 10. You are NOT a junior. When asked your grade, say: fourth grade or 4th grade. Some slang: cool, awesome, weird, cringe. Stay in character.',
  '5': 'CRITICAL: You are in GRADE 5 (fifth grade) only. You are 10 or 11. You are NOT a junior. When asked your grade, say: fifth grade or 5th grade. Some slang: slay, bruh, no cap, fire, bussin. Stay in character.',
  '6': 'CRITICAL: You are in GRADE 6 (sixth grade) only. You are 11 or 12. You are NOT a junior. When asked your grade, say: sixth grade or 6th grade. Middle-school slang: rizz, bussin, slay, no cap, bruh, fire, sus, cringe, skibidi, gyatt, fanum tax. Stay in character.',
  '7': 'CRITICAL: You are in GRADE 7 (seventh grade) only. You are 12 or 13. You are NOT a junior. When asked your grade, say: seventh grade or 7th grade. Slang: rizz, bussin, slay, no cap, bruh, fire, sus, mid, cooked, tea, lowkey. Stay in character.',
  '8': 'CRITICAL: You are in GRADE 8 (eighth grade) only. You are 13 or 14. You are NOT a junior. When asked your grade, say: eighth grade or 8th grade. Slang: rizz, bussin, slay, no cap, fire, tea, it\'s giving, period, bet, ate. Stay in character.',
  '9': 'CRITICAL: You are in GRADE 9 only. You are a FRESHMAN (9th grade). You are NOT a sophomore, junior, or senior. When asked your grade, say: ninth grade or freshman. Slang: lowkey, highkey, rizz, bussin, no cap, slay, period, bet, it\'s giving, ick, fr, ngl. Stay in character.',
  '10': 'CRITICAL: You are in GRADE 10 only. You are a SOPHOMORE (10th grade). You are NOT a freshman, junior, or senior. When asked your grade, say: tenth grade or sophomore. Slang: lowkey, highkey, rizz, bussin, no cap, slay, period, bet, it\'s giving, fr, ngl. Stay in character.',
  '11': 'CRITICAL: You are in GRADE 11 only. You are a JUNIOR (11th grade). "Junior" is correct only for you—11th graders are juniors. When asked your grade, say: eleventh grade or junior. You are 16 or 17. Slang: rizz, cap, bussin, lowkey, highkey, period, bet, no cap, slay, it\'s giving, ick, fr, ngl, deadass, mid, based. Stay in character.',
  '12': 'CRITICAL: You are in GRADE 12 only. You are a SENIOR (12th grade). You are NOT a junior. When asked your grade, say: twelfth grade or senior. You are 17 or 18. Slang: fr, deadass, ngl, lowkey, highkey, rizz, no cap, slay, period, bet, it\'s giving, mid, based, ion. Stay in character.'
};
const GRADE_AGES = {
  '1': '6 or 7', '2': '7 or 8', '3': '8 or 9', '4': '9 or 10', '5': '10 or 11',
  '6': '11 or 12', '7': '12 or 13', '8': '13 or 14', '9': '14 or 15', '10': '15 or 16',
  '11': '16 or 17', '12': '17 or 18'
};

app.use(express.json());
app.get('/', (req, res) => res.redirect('/facts.html'));
// Static: public/ for Vercel compatibility; __dirname for local dev
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.static(path.join(__dirname, '..')));

app.post('/api/chat', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server missing ANTHROPIC_API_KEY. Add it to a .env file.' });
  const body = req.body || {};
  const message = body.message;
  const persona = body.persona || '6';
  const userName = body.userName ?? body.user_name ?? '';
  const text = typeof message === 'string' ? message.trim() : '';
  if (!text) return res.status(400).json({ error: 'Message is required.' });
  const name = String(userName || '').trim();
  const gradeNum = String(persona).trim() || '6';
  const age = GRADE_AGES[gradeNum] || GRADE_AGES['6'];
  const g = parseInt(gradeNum, 10) || 6;
  let system = PERSONAS[gradeNum] || PERSONAS['6'];
  const noCollege = g <= 11
    ? `NEVER say you graduated college, graduated school, or finished college. You are in grade ${gradeNum}—you have not graduated anything. You are still in school.\n\n`
    : `You are in 12th grade (senior). You have NOT graduated college—you are still in high school. Never say you graduated college.\n\n`;
  system = `Keep replies SHORT: 1-4 sentences max. No long paragraphs. Chat like a kid/teen texting—brief and natural.\n\n${noCollege}You are playing a student in GRADE ${gradeNum} ONLY. You are ${age} years old. When someone asks your age, say you are ${age} years old. The number ${gradeNum} is your grade. Do not say you are in any other grade. Only if grade is 11 can you say "junior". If grade is not 11, never say junior.\n\n` + system;
  if (name) system = `The person you are chatting with is named ${name}. Always use their name when you reply (e.g. start your reply with their name).\n\n` + system;
  const gradeReminder = g <= 11 ? `You are in grade ${gradeNum}. You have NEVER graduated college or graduated school. Do not say you graduated. ` : `You are in grade ${gradeNum}. You have not graduated college. `;
  const userContent = name ? `[The user's name is ${name}. ${gradeReminder}Never say junior unless grade is 11.]\n\n${text}` : `[${gradeReminder}You are in grade ${gradeNum}. Never say junior unless grade is 11.]\n\n${text}`;
  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({ model: 'claude-3-5-sonnet-latest', max_tokens: 256, system, messages: [{ role: 'user', content: userContent }] });
    const block = response.content?.find(b => b.type === 'text');
    res.json({ reply: block?.text?.trim() || "I didn't get a reply." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err?.message || 'Request to Claude failed.' });
  }
});

// ── Fun Facts: pool + queue ─────────────────────────────────────────────────
const CATEGORIES = ['science','history','animals','space','food','random'];
const TARGET_POOL = 100, BATCH_SIZE = 10;
const pool = {}, queue = {}, generating = {}, pendingGenerations = {};
CATEGORIES.forEach(c => {
  pool[c] = [];
  queue[c] = [];
  generating[c] = false;
  pendingGenerations[c] = null;
});

const TOPIC_SEEDS = {
  science: ['the human body','electricity','chemistry','gravity','DNA','light','the brain','sound waves','magnetism','photosynthesis','black holes','atoms','vaccines','evolution','deep sea creatures','nuclear energy','the immune system','sleep','the digestive system','genetics','plate tectonics','the periodic table','thermodynamics','viruses','neurons','radioactivity','quantum mechanics','the speed of light','osmosis','carbon dating'],
  history: ['ancient Rome','World War II','ancient Egypt','the Vikings','the Renaissance','the Cold War','ancient China','the French Revolution','the Ottoman Empire','the Silk Road','medieval Europe','ancient Greece','the Aztecs','the American Civil War','the Moon landing','the Black Death','the Byzantine Empire','the Mongol Empire','ancient Mesopotamia','the Industrial Revolution','the Spanish Inquisition','Napoleon Bonaparte','the Salem witch trials','the Crusades','ancient Japan','the Roman Colosseum','Cleopatra','Julius Caesar','the printing press','the transatlantic slave trade'],
  animals: ['dolphins','octopuses','elephants','sharks','penguins','cheetahs','bees','crows','axolotls','mantis shrimp','komodo dragons','tardigrades','honey badgers','platypuses','wolves','hummingbirds','archerfish','pistol shrimp','naked mole rats','mimic octopuses','electric eels','bombardier beetles','vampire bats','lyrebirds','alpine swifts','leafcutter ants','immortal jellyfish'],
  space: ['Mars','black holes','the Moon','Jupiter','Saturn','neutron stars','the Sun','comets','the ISS','dark matter','Pluto','supernovas','the Milky Way','exoplanets','the Big Bang','Venus','Uranus','Neptune','asteroid belts','white dwarfs','pulsars','quasars','wormholes','the Oort Cloud','solar flares','Europa','Titan','the Voyager probes','gravitational waves','cosmic background radiation'],
  food: ['chocolate','coffee','spicy food','cheese','bread','sushi','honey','salt','hot dogs','pizza','ice cream','bananas','garlic','wine','chili peppers','wasabi','truffles','vanilla','maple syrup','olive oil','tea','popcorn','fermented foods','MSG','butter','vinegar','cinnamon','blue cheese','sourdough','pineapple'],
  random: ['the Eiffel Tower','playing cards','fingernails','lightning','the Great Wall','rubber ducks','banknotes','escalators','belly buttons','left-handedness','yawning','laughing','dreams','color perception','the alphabet','hiccups','mirrors','dice','elevators','staplers','vending machines','bubble wrap','Post-it notes','zippers','Velcro','superglue','microwave ovens','traffic lights','sunglasses','umbrellas']
};

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function refillQueue(cat) { queue[cat] = shuffle(pool[cat].map((_, i) => i)); }
function dequeue(cat) {
  if (queue[cat].length === 0) refillQueue(cat);
  return pool[cat][queue[cat].pop()];
}

async function generateBatch(cat) {
  if (generating[cat]) return pendingGenerations[cat];
  
  let resolveGeneration;
  pendingGenerations[cat] = new Promise(resolve => { resolveGeneration = resolve; });
  generating[cat] = true;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    generating[cat] = false;
    pendingGenerations[cat] = null;
    resolveGeneration();
    return;
  }
  const usedTopics = new Set(pool[cat].map(f => f._topic));
  const available = (TOPIC_SEEDS[cat] || TOPIC_SEEDS.random).filter(t => !usedTopics.has(t));
  const seeds = available.length >= BATCH_SIZE ? available : (TOPIC_SEEDS[cat] || TOPIC_SEEDS.random);
  const half = BATCH_SIZE / 2;
  const shuffledTopics = shuffle([...seeds]).slice(0, BATCH_SIZE);
  const isTrueAssignments = shuffle([...Array(half).fill(true), ...Array(half).fill(false)]);
  const assignments = shuffledTopics.map((topic, i) => ({ topic, isTrue: isTrueAssignments[i] }));
  const trueOnes = assignments.filter(a => a.isTrue).map(a => a.topic);
  const falseOnes = assignments.filter(a => !a.isTrue).map(a => a.topic);
  const system = `You are a fact-checker and trivia writer generating content for a "Fact or Fake?" game about the category "${cat}".
ACCURACY IS THE TOP PRIORITY. Only include facts you are highly confident are correct (>95% certainty). If you are unsure about a detail, do not use it — pick a different angle you ARE sure about.
Generate EXACTLY ${BATCH_SIZE} facts total:
TRUE facts (isTrue: true) — statements that are genuinely, verifiably true. One per topic:
${trueOnes.map((t, i) => `${i + 1}. "${t}"`).join('\n')}
FALSE facts (isTrue: false) — statements that sound plausible but are factually wrong. The explanation MUST state the real, accurate truth clearly. One per topic:
${falseOnes.map((t, i) => `${i + 1}. "${t}"`).join('\n')}
STRICT RULES:
- Every "text" field must be a single, unambiguous declarative sentence.
- For TRUE facts: the explanation confirms why it is true with a concrete detail.
- For FALSE facts: the explanation must clearly state what the actual truth is (not just say "this is false").
- Never use hedging language like "approximately", "around", or "roughly" in the fact text — be precise.
- Never invent statistics. If a number appears in a TRUE fact, it must be a well-documented, widely cited figure.
- Return all ${BATCH_SIZE} facts in a RANDOM mixed order (do NOT group true then false).
Respond with ONLY a raw JSON array — no markdown, no extra text:
[{"text":"<one precise declarative sentence>","isTrue":true or false,"category":"${cat}","hint":"<a subtle nudge>","explanation":"<1-2 sentences>"}]`;
  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({ model: 'claude-3-5-sonnet-latest', max_tokens: 2800, system, messages: [{ role: 'user', content: 'Generate the mixed facts array now.' }] });
    const rawContent = resp.content?.find(b => b.type === 'text')?.text || '';
    
    // More robust JSON extraction
    let jsonStr = rawContent.trim();
    const jsonMatch = jsonStr.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonMatch) jsonStr = jsonMatch[0];
    else jsonStr = jsonStr.replace(/^```json?\n?/, '').replace(/\n?```$/, '');

    const batch = JSON.parse(jsonStr);
    if (Array.isArray(batch)) {
      batch.forEach((f, i) => { f._topic = shuffledTopics[i] || shuffledTopics[0]; });
      pool[cat].push(...shuffle(batch));
      console.log(`[facts] pool[${cat}] now has ${pool[cat].length} facts`);
    }
  } catch (err) {
    console.error(`[facts] batch error for ${cat}:`, err.message);
  } finally {
    generating[cat] = false;
    const currentPromise = pendingGenerations[cat];
    pendingGenerations[cat] = null;
    resolveGeneration();
    return currentPromise;
  }
}

app.post('/api/facts', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY.' });
  const cat = (req.body?.category || 'random').toLowerCase();
  const hard = !!req.body?.hard;
  if (!CATEGORIES.includes(cat)) return res.status(400).json({ error: 'Unknown category.' });
  if (hard) {
    const mustBeTrue = Math.random() < 0.5;
    const seeds = TOPIC_SEEDS[cat] || TOPIC_SEEDS.random;
    const topic = seeds[Math.floor(Math.random() * seeds.length)];
    const system = `You are a fact-checker writing a hard trivia question. ACCURACY IS MANDATORY.
${mustBeTrue ? `Write a TRUE fact about "${topic}" that sounds counterintuitive or surprising. It must be verifiably, 100% true.` : `Write a FALSE statement about "${topic}" that sounds like a widely believed fact. The explanation MUST clearly state what the actual truth is.`}
Respond with ONLY raw JSON, no markdown:
{"text":"<one precise declarative sentence>","isTrue":${mustBeTrue},"category":"${cat}","hint":"<a very subtle nudge>","explanation":"<1-2 sentences>"}`;
    try {
      const client = new Anthropic({ apiKey });
      const resp = await client.messages.create({ model: 'claude-3-5-sonnet-latest', max_tokens: 350, system, messages: [{ role: 'user', content: 'Generate the hard final question now.' }] });
      const raw = (resp.content?.find(b => b.type === 'text')?.text || '').trim().replace(/^```json?\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(raw);
      parsed.isTrue = mustBeTrue;
      return res.json(parsed);
    } catch (err) { console.error('[hard fact]', err.message); }
  }
  if (pool[cat].length === 0) {
    await generateBatch(cat);
    if (pool[cat].length === 0) {
      return res.status(500).json({ error: 'Could not generate facts. Check your API key or try again.' });
    }
    refillQueue(cat);
  }
  const fact = dequeue(cat);
  if (pool[cat].length < TARGET_POOL && !generating[cat]) generateBatch(cat);
  res.json(fact);
});

// Pre-warm only for local dev (serverless cold start would fire 6 parallel AI calls and freeze)
if (!process.env.VERCEL) {
  CATEGORIES.forEach(cat => generateBatch(cat).then(() => refillQueue(cat)));
}

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
  const messages = [...history.map(h => ({ role: h.role, content: h.content })), { role: 'user', content: message }];
  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({ model: 'claude-3-5-haiku-latest', max_tokens: 100, system, messages });
    const block = response.content?.find(b => b.type === 'text');
    res.json({ reply: block?.text?.trim() || "I'm not sure about that one!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err?.message || 'AI request failed.' });
  }
});

// ── Auth & leaderboard stubs (no DB yet — add later) ─────────────────────────
app.post('/api/auth/register', (req, res) => res.status(503).json({ error: 'Sign up coming soon.' }));
app.post('/api/auth/login', (req, res) => res.status(503).json({ error: 'Sign in coming soon.' }));
app.get('/api/auth/me', (req, res) => res.status(401).json({ error: 'Not available.' }));
app.patch('/api/auth/avatar', (req, res) => res.status(503).json({ error: 'Coming soon.' }));
app.get('/api/check-username', (req, res) => res.json({ taken: false }));
app.post('/api/leaderboard/save', (req, res) => res.status(503).json({ error: 'Leaderboard coming soon.' }));
app.get('/api/leaderboard', (req, res) => res.json([]));

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT}/facts.html for the Fun Facts game!`);
  });
}

export default app;
