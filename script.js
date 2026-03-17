const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

const board = document.getElementById('board');
const status = document.getElementById('status');
const resetBtn = document.getElementById('reset');
const vsBotCheckbox = document.getElementById('vsBot');

let state = {
  cells: Array(9).fill(null),
  currentPlayer: 'X',
  phase: 'trapX',
  trapX: null,
  trapO: null,
  over: false,
  loseReason: null
};

function getVsBot() {
  return !!vsBotCheckbox?.checked;
}

function getLineIfComplete(cells, a, b, c) {
  const v = cells[a];
  if (v && cells[a] === cells[b] && cells[b] === cells[c]) return [a, b, c];
  return null;
}

function findCompletedLine(cells) {
  for (const [a, b, c] of LINES) {
    const line = getLineIfComplete(cells, a, b, c);
    if (line) return line;
  }
  return null;
}

function allFilled(cells) {
  return cells.every(Boolean);
}

function getEmptyIndices(cells) {
  return cells.map((v, i) => (v === null ? i : -1)).filter((i) => i >= 0);
}

// --- Bot: minimax for misère + traps (O maximizes, X minimizes) ---
function evaluate(cells, trapX, trapO, currentPlayer) {
  const line = findCompletedLine(cells);
  if (line) {
    const whoMadeLine = cells[line[0]];
    return whoMadeLine === 'O' ? -1 : 1;
  }
  const draw = allFilled(cells);
  if (draw) return 0;
  return null;
}

function minimax(cells, trapX, trapO, currentPlayer, depth, alpha, beta) {
  const line = findCompletedLine(cells);
  if (line) {
    return { score: cells[line[0]] === 'O' ? -1 : 1, move: null };
  }
  if (allFilled(cells)) return { score: 0, move: null };

  const empty = getEmptyIndices(cells);
  const isO = currentPlayer === 'O';
  const trapToAvoid = isO ? trapX : trapO;
  const legal = empty.filter((i) => i !== trapToAvoid);

  if (legal.length === 0) return { score: isO ? -1 : 1, move: null };

  let bestScore = isO ? -2 : 2;
  let bestMove = legal[0];

  for (const idx of legal) {
    const next = cells.slice();
    next[idx] = currentPlayer;
    const { score } = minimax(next, trapX, trapO, isO ? 'X' : 'O', depth + 1, alpha, beta);

    if (isO) {
      if (score > bestScore) {
        bestScore = score;
        bestMove = idx;
      }
      alpha = Math.max(alpha, score);
    } else {
      if (score < bestScore) {
        bestScore = score;
        bestMove = idx;
      }
      beta = Math.min(beta, score);
    }
    if (beta <= alpha) break;
  }
  return { score: bestScore, move: bestMove };
}

function botPickTrap() {
  const empty = getEmptyIndices(state.cells);
  if (empty.length === 0) return;
  const trapX = state.trapX;
  const avoid = trapX !== null ? [trapX] : [];
  const choices = empty.filter((i) => !avoid.includes(i));
  return choices[Math.floor(Math.random() * choices.length)];
}

function botMove() {
  const { cells, trapX, trapO, currentPlayer } = state;
  if (currentPlayer !== 'O' || state.over || state.phase !== 'play') return;
  const empty = getEmptyIndices(cells);
  const legal = empty.filter((i) => i !== trapX);
  if (legal.length === 0) return;
  const { move } = minimax(cells.slice(), trapX, trapO, 'O', 0, -2, 2);
  if (move !== null) makeMove(move);
}

function setTrap(index) {
  if (state.phase === 'trapX') {
    state.trapX = index;
    state.phase = 'trapO';
    render();
    if (getVsBot()) setTimeout(() => { state.trapO = botPickTrap(); state.phase = 'play'; render(); }, 400);
  } else if (state.phase === 'trapO' && !getVsBot()) {
    state.trapO = index;
    state.phase = 'play';
    render();
  }
}

function render() {
  const { cells, currentPlayer, over, phase, trapX, trapO, loseReason } = state;

  if (phase === 'trapX') {
    status.textContent = 'X: click an empty cell to set your trap';
    status.className = 'status x-turn';
  } else if (phase === 'trapO' && !getVsBot()) {
    status.textContent = 'O: click an empty cell to set your trap';
    status.className = 'status o-turn';
  } else if (phase === 'trapO' && getVsBot()) {
    status.textContent = 'Bot is setting its trap…';
    status.className = 'status o-turn';
  } else if (over) {
    if (loseReason === 'trap') {
      const loser = currentPlayer;
      status.textContent = `${loser} stepped on a trap — ${loser} loses!`;
      status.className = 'status ' + loser.toLowerCase() + '-loses';
    } else {
      const completedLine = findCompletedLine(cells);
      const loser = completedLine ? cells[completedLine[0]] : null;
      status.textContent = loser
        ? `${loser} made a line — ${loser} loses!`
        : "It's a draw — no line, no winner.";
      status.className = 'status';
      if (loser) status.classList.add(loser.toLowerCase() + '-loses');
      else status.classList.add('draw');
    }
  } else {
    status.textContent = `${currentPlayer} to move`;
    status.className = 'status ' + currentPlayer.toLowerCase() + '-turn';
  }

  const completedLine = !state.loseReason && phase === 'play' ? findCompletedLine(cells) : null;

  board.querySelectorAll('.cell').forEach((cell, i) => {
    const value = cells[i];
    cell.textContent = value || '';
    let cls = 'cell' + (value ? ' ' + value.toLowerCase() : '');
    if (!value && trapX === i) cls += ' trap-x';
    if (!value && trapO === i) cls += ' trap-o';
    if (completedLine && completedLine.includes(i)) cls += ' losing-line';
    cell.className = cls;
    const disabled = over || (phase === 'play' && !!value) || (phase === 'trapX' && value) || (phase === 'trapO' && (value || getVsBot()));
    cell.disabled = !!disabled;
  });

  if (phase === 'play' && !over && getVsBot() && currentPlayer === 'O') setTimeout(botMove, 350);
}

function makeMove(index) {
  const { cells, currentPlayer, phase, trapX, trapO, over } = state;
  if (over || phase !== 'play' || cells[index]) return;

  const steppedOnTrap = (currentPlayer === 'X' && index === trapO) || (currentPlayer === 'O' && index === trapX);
  if (steppedOnTrap) {
    state.over = true;
    state.loseReason = 'trap';
    render();
    return;
  }

  const next = cells.slice();
  next[index] = currentPlayer;
  const completedLine = findCompletedLine(next);
  const draw = allFilled(next) && !completedLine;

  state = {
    ...state,
    cells: next,
    currentPlayer: currentPlayer === 'X' ? 'O' : 'X',
    over: !!completedLine || draw,
    loseReason: completedLine ? 'line' : null
  };
  render();
}

function handleCellClick(e) {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  const index = Number(cell.dataset.index);
  if (state.phase === 'trapX' || state.phase === 'trapO') {
    if (state.cells[index] === null) setTrap(index);
  } else {
    makeMove(index);
  }
}

function init() {
  state = {
    cells: Array(9).fill(null),
    currentPlayer: 'X',
    phase: 'trapX',
    trapX: null,
    trapO: null,
    over: false,
    loseReason: null
  };
  render();
}

board.addEventListener('click', handleCellClick);
resetBtn.addEventListener('click', init);

// --- Generation / age-style chatbot ---

const chatWindow = document.getElementById('chatWindow');
const chatInput = document.getElementById('chatInput');
const chatSend = document.getElementById('chatSend');
const personaSelect = document.getElementById('personaSelect');

function appendMessage(text, who) {
  if (!chatWindow) return;
  const div = document.createElement('div');
  div.className = 'chat-message ' + (who === 'user' ? 'user' : 'bot');

  const label = document.createElement('small');
  label.textContent = who === 'user' ? 'You' : 'Bot';

  const body = document.createElement('div');
  body.textContent = text;

  div.appendChild(label);
  div.appendChild(body);
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function styleReply(base, persona) {
  const trimmed = base.trim();
  if (!trimmed) return '';

  switch (persona) {
    case 'child':
      return (
        "I'm a kid in elementary school. " +
        "So, I think: " +
        trimmed.replace(/because/gi, '’cause')
      );
    case 'middle':
      return (
        "Middle school me would say: " +
        trimmed +
        " That’s kinda cool, I guess."
      );
    case 'teen':
      return (
        "As a high schooler, I’d be like, " +
        trimmed +
        " It’s a big deal to me."
      );
    case 'genz':
      return (
        "Okay so, real talk: " +
        trimmed +
        " — low‑key relatable, not gonna lie."
      );
    case 'adult':
      return (
        "From an adult point of view, " +
        trimmed +
        " makes sense. I’d try to handle it calmly."
      );
    case 'senior':
      return (
        "Speaking as someone in their seventies, " +
        trimmed +
        " reminds me that things change, but people stay people."
      );
    default:
      return trimmed;
  }
}

function generateReply(userText, persona) {
  const text = userText.trim();
  if (!text) return '';

  let base;
  if (/how\b/i.test(text)) {
    base = "Here’s how I see it: " + text;
  } else if (/why\b/i.test(text)) {
    base = "My guess is: " + text;
  } else if (/\?$/.test(text)) {
    base = "Good question. " + text + " I’d think about it a bit.";
  } else {
    base = "I hear you saying: " + text;
  }

  return styleReply(base, persona);
}

function handleSend() {
  if (!chatInput) return;
  const value = chatInput.value;
  const persona = personaSelect ? personaSelect.value : 'teen';
  const reply = generateReply(value, persona);
  if (!reply) return;

  appendMessage(value, 'user');
  appendMessage(reply, 'bot');
  chatInput.value = '';
  chatInput.focus();
}

if (chatSend && chatInput) {
  chatSend.addEventListener('click', handleSend);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });
}

init();
