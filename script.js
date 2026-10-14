
'use strict';

// GREG.EXE — corrected standalone game.js
// Works with the existing index.html and style.css from v0.6/v0.7.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const $ = id => document.getElementById(id);

const WORLD_WIDTH = 1600;
const WORLD_HEIGHT = 960;
const SAVE_KEY = 'greg-exe-v01';

const keys = {
  up: false,
  down: false,
  left: false,
  right: false
};

const player = { speed: 175 };

let running = false;
let lastFrame = 0;
let dialogue = null;
let tutorialStage = 'idle';
let tutorialStartX = 0;
let tutorialStartY = 0;
let choiceOpen = false;
let toastTimer = null;
let walkTick = 0;

// ---------- SAVE SYSTEM ----------

function loadGame() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY)) || {};
  } catch {
    return {};
  }
}

const saved = loadGame();

const state = {
  x: saved.x ?? 800,
  y: saved.y ?? 745,
  dir: saved.dir || 'down',
  scene: saved.scene || 'valley',
  hearts: saved.hearts || [],
  items: saved.items || [],
  talked: saved.talked || [],
  cafeOrders: saved.cafeOrders || [],
  cafeTalks: saved.cafeTalks || 0,
  cafeWelcomeSeen: !!saved.cafeWelcomeSeen,
  cafeChoiceSeen: !!saved.cafeChoiceSeen,
  tutorialDone: !!saved.tutorialDone
};

function save() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function add(array, value) {
  if (!array.includes(value)) {
    array.push(value);
  }
}

function resetGame() {
  localStorage.removeItem(SAVE_KEY);
  location.reload();
}

function updateUI() {
  $('hearts').textContent =
    `💗 ${state.hearts.length} / 3`;

  $('inventory').textContent =
    `🎒 ${state.items.length} items`;

  $('objective').textContent = !state.tutorialDone
    ? tutorialStage === 'move'
      ? 'Tutorial: Walk using WASD or the arrow keys'
      : tutorialStage === 'sign'
        ? 'Tutorial: Inspect the glowing welcome sign'
        : 'Tutorial: Welcome to Little Heart Valley!'
    : state.hearts.length < 3
      ? 'Find the three heart fragments!'
      : 'All three hearts found! Visit the secret pond.';
}

function showToast(message) {
  const el = $('toast');

  el.textContent = message;
  el.style.display = 'block';

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    el.style.display = 'none';
  }, 2800);
}

// ---------- APPROVED CHARACTER ART ----------

const walkSheets = {};

for (const id of ['greg', 'dev']) {
  const image = new Image();
  image.src = `assets/${id}_walk.png`;
  walkSheets[id] = image;
}

const characterImages = {
  greg: new Image(),
  dev: new Image()
};

characterImages.greg.src = 'assets/greg.png';
characterImages.dev.src = 'assets/dev.png';

function drawCharacter(
  x,
  y,
  style,
  direction = 'down',
  moving = false
) {
  const sheet = walkSheets[style];

  if (sheet.complete && sheet.naturalWidth >= 400) {
    const row = {
      down: 0,
      up: 1,
      left: 2,
      right: 3
    }[direction] ?? 0;

    const frame = moving
      ? Math.floor(walkTick / 7) % 5
      : 0;

    ctx.drawImage(
      sheet,
      frame * 80,
      row * 88,
      80,
      88,
      Math.round(x - 32),
      Math.round(y - 56),
      64,
      70
    );

    return;
  }

  const image = characterImages[style];

  if (image.complete && image.naturalWidth) {
    ctx.drawImage(
      image,
      Math.round(x - 25),
      Math.round(y - 52),
      50,
      60
    );
  } else {
    ctx.fillStyle =
      style === 'greg' ? '#f5f5ec' : '#f4a3ca';

    ctx.fillRect(x - 13, y - 34, 26, 34);

    ctx.fillStyle = '#45344b';
    ctx.fillRect(x - 9, y - 48, 18, 17);
  }
}

// ---------- DRAWING HELPERS ----------

function rect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function label(
  text,
  x,
  y,
  color = '#594363',
  size = 14
) {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
}

function distance(x, y) {
  return Math.hypot(
    state.x - x,
    state.y - y
  );
}

// ---------- DIALOGUE SYSTEM ----------

function startDialogue(speaker, lines, onDone = null) {
  closeChoices();

  dialogue = {
    speaker,
    lines,
    index: 0,
    onDone
  };

  displayDialogue();
}

function displayDialogue() {
  if (!dialogue) {
    $('dialog').style.display = 'none';
    return;
  }

  $('speaker').textContent = dialogue.speaker;

  $('speech').textContent =
    dialogue.lines[dialogue.index];

  $('dialog').style.display = 'block';
}

function advanceDialogue() {
  if (!dialogue) return;

  dialogue.index++;

  if (dialogue.index < dialogue.lines.length) {
    return displayDialogue();
  }

  const callback = dialogue.onDone;

  dialogue = null;
  displayDialogue();

  if (callback) callback();
}


// ---------- OPENING TUTORIAL ----------

function startTutorial() {
  state.scene = 'valley';

  state.x = 800;
  state.y = 745;
  state.dir = 'down';

  tutorialStage = 'intro';

  tutorialStartX = state.x;
  tutorialStartY = state.y;

  updateUI();

  // Greg wakes up in the pixel world.
  startDialogue('GREG', [
    '...Uh. Hello?',
    "Wasn't I just on my computer?",
    'Why am I standing in the middle of a pixel village?',
    'And why does that sign say GREG.EXE?!',
    "Okay. Either I'm dreaming or somebody put a suspicious amount of effort into this."
  ], () => {

    // The system introduces the game.
    startDialogue('??? · SYSTEM', [
      'WELCOME TO LITTLE HEART VALLEY, GREG! 🌸',
      'This is a tiny world made just for you. No pressure. Probably.',
      "First things first: let's learn how to move.",
      'Use WASD or the arrow keys. On mobile, use the direction buttons below.'
    ], () => {

      tutorialStage = 'move';

      updateUI();

      showToast(
        '🎮 TUTORIAL: Walk a few steps!'
      );
    });
  });
}

// Detect whether Greg has walked far enough.
function checkTutorialMovement() {
  if (tutorialStage !== 'move') return;

  const distanceMoved = Math.hypot(
    state.x - tutorialStartX,
    state.y - tutorialStartY
  );

  if (distanceMoved < 65) return;

  tutorialStage = 'sign';

  updateUI();

  startDialogue('SYSTEM TUTORIAL', [
    'Great! You figured out how to walk.',
    'Now find the glowing WELCOME sign nearby and press E or ✦ to inspect it.'
  ]);
}

// Finish the tutorial after Greg inspects the sign.
function completeTutorial() {
  tutorialStage = 'done';

  state.tutorialDone = true;

  save();
  updateUI();

  startDialogue('SYSTEM TUTORIAL', [
    'Nice work! You found the welcome sign.',
    'You can talk to villagers, inspect objects, and enter buildings with E or ✦.',
    'Open 📖 Quests to track your progress. Find three heart fragments to unlock a secret!',
    'Tutorial complete! Explore Little Heart Valley at your own pace. ♡'
  ], () => {
    showToast(
      '✨ Tutorial complete! Adventure unlocked!'
    );
  });
}


// ---------- THE BLUSHING BEAN CAFÉ ----------

const cafeMenu = [
  {
    id: 'coffee',
    name: '☕ Cherry Blossom Latte',
    desc: 'Sweet floral coffee',
    lines: [
      'Excellent choice!',
      'The foam art is a flower. If it looks like a potato, no it doesn’t.'
    ]
  },
  {
    id: 'tea',
    name: '🍵 Honey Lavender Tea',
    desc: 'A relaxing afternoon drink',
    lines: [
      'Very sophisticated.',
      'I was going to make a joke, but this smells amazing.'
    ]
  },
  {
    id: 'cake',
    name: '🍰 Strawberry Cloud Cake',
    desc: 'Fluffy cake with pink frosting',
    lines: [
      'One strawberry cloud cake!',
      'The recipe is secret. Mostly because I improvised.'
    ]
  },
  {
    id: 'cookie',
    name: '🍪 Lucky Heart Cookie',
    desc: 'A mysterious little fortune',
    lines: [
      'Your fortune says: An unexpected side quest will improve your day.',
      'Weirdly specific, huh?'
    ]
  }
];

// ---------- CHOICE MENU ----------

const choicePanel = document.createElement('div');

choicePanel.className = 'cafe-choice hidden';
choicePanel.id = 'cafeChoices';

document.querySelector('.screen').appendChild(
  choicePanel
);

function closeChoices() {
  choiceOpen = false;

  choicePanel.classList.add('hidden');
  choicePanel.replaceChildren();
}

function showChoices(title, options) {
  choiceOpen = true;
  choicePanel.replaceChildren();

  const heading = document.createElement('h3');
  heading.textContent = title;

  choicePanel.appendChild(heading);

  for (const option of options) {
    const button = document.createElement('button');
    button.className = 'cafe-option';

    const name = document.createElement('strong');
    name.textContent = option.label;

    button.appendChild(name);

    if (option.desc) {
      const desc = document.createElement('span');
      desc.textContent = option.desc;

      button.appendChild(desc);
    }

    button.onclick = () => {
      closeChoices();
      option.action();
    };

    choicePanel.appendChild(button);
  }

  const cancel = document.createElement('button');

  cancel.className = 'cafe-option cancel';
  cancel.textContent = '↩ Maybe later';
  cancel.onclick = closeChoices;

  choicePanel.appendChild(cancel);
  choicePanel.classList.remove('hidden');
}

// ---------- ORDERING ----------

function cafeOrderChoices() {
  showChoices(
    'The Blushing Bean · Today’s Menu',

    cafeMenu.map(item => ({
      label: item.name,
      desc: item.desc,

      action: () => {
        add(state.cafeOrders, item.id);

        add(
          state.items,
          `cafe_${item.id}`
        );

        state.cafeTalks++;

        save();
        updateUI();

        startDialogue(
          'The Developer',
          [
            ...item.lines,
            'No charge. Consider it a quest perk.'
          ],
          () => showToast(
            `🎒 ${item.name} added to your bag!`
          )
        );
      }
    }))
  );
}

// ---------- CONVERSATION CHOICES ----------

function cafeConversation() {
  showChoices('What do you say?', [
    {
      label: 'What would you recommend?',
      desc: 'Ask the expert. Allegedly.',

      action: () => startDialogue(
        'The Developer',
        [
          'Me? An expert? That’s a dangerous assumption.',
          'Try the cherry blossom latte. I made the recipe myself.',
          'The first three attempts are classified information.'
        ],
        cafeOrderChoices
      )
    },
    {
      label: 'This place is really cute.',
      desc: 'A genuine compliment.',

      action: () => startDialogue(
        'The Developer',
        [
          'Oh. Thanks!',
          'I spent way too long deciding where the plants should go.',
          'Please pretend you didn’t notice the one that’s slightly crooked.'
        ],
        () => {
          state.cafeChoiceSeen = true;

          save();

          cafeOrderChoices();
        }
      )
    },
    {
      label: 'Is the cake actually homemade?',
      desc: 'Ask the important question.',

      action: () => startDialogue(
        'The Developer',
        [
          'Absolutely. Unless it tastes weird. Then a mysterious baker made it.',
          'Kidding! Mostly.'
        ],
        cafeOrderChoices
      )
    },
    {
      label: 'I should probably keep exploring.',
      desc: 'Back to the side quest.',

      action: () => startDialogue(
        'The Developer',
        [
          'Fair enough. The valley isn’t going anywhere.',
          'Neither is the cake, probably.'
        ]
      )
    }
  ]);
}

// ---------- TALK TO THE DEVELOPER ----------

function talkToCafeDeveloper() {
  startDialogue(
    'The Developer',

    state.cafeTalks > 0
      ? [
          'Oh, hey, Greg. Back for another snack?',
          'I respect the dedication.'
        ]
      : [
          'Welcome to The Blushing Bean!',
          'Coffee, cake, or a questionable conversation?'
        ],

    cafeConversation
  );
}

// ---------- ENTER CAFÉ ----------

function enterCafe() {
  state.scene = 'cafe';

  state.x = 400;
  state.y = 400;
  state.dir = 'up';

  save();

  if (!state.cafeWelcomeSeen) {
    state.cafeWelcomeSeen = true;

    save();

    startDialogue('The Developer', [
      'Oh! Greg?!',
      'I mean—welcome to The Blushing Bean!',
      'I definitely knew you were coming. Obviously.',
      'Coffee? Pastries? Absolutely normal customer service?'
    ]);
  } else {
    showToast(
      '☕ Welcome back to The Blushing Bean!'
    );
  }
}

// ---------- EXIT CAFÉ ----------

function leaveCafe() {
  state.scene = 'valley';

  state.x = 738;
  state.y = 475;
  state.dir = 'down';

  save();

  showToast(
    '🌸 Back in Little Heart Valley!'
  );
}


// ---------- WORLD OBJECTS ----------

const hearts = [
  {
    id: 'tulips',
    x: 350,
    y: 620,
    name: 'Blue Tulip Heart'
  },
  {
    id: 'arcade',
    x: 1250,
    y: 620,
    name: 'Arcade Heart'
  },
  {
    id: 'pond',
    x: 1220,
    y: 790,
    name: 'Pond Heart'
  }
];

// ---------- INTERACTIONS ----------

function interact() {
  if (!running) return;

  if (dialogue) {
    return advanceDialogue();
  }

  if (choiceOpen) return;

  if (!$('journal').classList.contains('hidden')) {
    return;
  }

  // Interactions inside the café.
  if (state.scene === 'cafe') {
    if (distance(400, 100) < 140) {
      return talkToCafeDeveloper();
    }

    if (distance(400, 445) < 75) {
      return leaveCafe();
    }

    if (distance(210, 220) < 95) {
      return startDialogue('PASTRY DISPLAY', [
        'Made with love. Allegedly.',
        'Everything looks dangerously delicious.'
      ]);
    }

    if (distance(610, 220) < 95) {
      return startDialogue('BLUE TULIPS', [
        'These flowers look strangely familiar.'
      ]);
    }

    return showToast(
      'Walk closer to the counter or the exit.'
    );
  }

  // Tutorial interactions.
  if (tutorialStage === 'move') {
    return showToast(
      '🎮 First, try walking a few steps!'
    );
  }

  if (tutorialStage === 'sign') {
    if (distance(800, 685) < 125) {
      return completeTutorial();
    }

    return showToast(
      '🌸 Walk closer to the glowing WELCOME sign!'
    );
  }

  // Welcome sign.
  if (distance(800, 685) < 115) {
    return startDialogue('WELCOME SIGN', [
      'Welcome to Little Heart Valley!',
      'A suspiciously personalized adventure awaits.'
    ]);
  }

  // Café entrance.
  if (distance(738, 450) < 110) {
    return enterCafe();
  }

  // Heart fragments.
  for (const heart of hearts) {
    if (distance(heart.x, heart.y) < 90) {
      if (state.hearts.includes(heart.id)) {
        return showToast(
          'You already found this heart!'
        );
      }

      add(state.hearts, heart.id);

      save();
      updateUI();

      return startDialogue('SYSTEM', [
        `You found the ${heart.name}! 💗`,
        `${state.hearts.length} / 3 heart fragments collected.`
      ]);
    }
  }

  // Faceless NPCs.
  if (distance(300, 340) < 110) {
    return startDialogue('FLORIST', [
      'The blue tulips are looking especially pretty today.'
    ]);
  }

  if (distance(1280, 340) < 110) {
    return startDialogue('ARCADE KID', [
      'I almost beat the high score. Almost.'
    ]);
  }

  // Secret pond.
  if (
    distance(1240, 835) < 110 &&
    state.hearts.length === 3
  ) {
    return startDialogue('SECRET POND', [
      'The pond glows softly in the spring sunshine.',
      'Some adventures are better when you take your time. ♡'
    ]);
  }

  showToast(
    'Nothing to interact with here. Try walking closer!'
  );
}


// ---------- KEYBOARD CONTROLS ----------

const directions = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right'
};

document.addEventListener('keydown', event => {
  const dir = directions[event.code];

  if (dir) {
    event.preventDefault();
    keys[dir] = true;
  }

  if (
    event.code === 'KeyE' ||
    event.code === 'Space'
  ) {
    event.preventDefault();

    if (!event.repeat) {
      interact();
    }
  }

  if (event.code === 'Escape') {
    closeChoices();
  }
});

document.addEventListener('keyup', event => {
  const dir = directions[event.code];

  if (dir) {
    keys[dir] = false;
  }
});

window.addEventListener('blur', () => {
  Object.keys(keys).forEach(k => {
    keys[k] = false;
  });
});

// ---------- MOBILE CONTROLS ----------

for (
  const button of
  document.querySelectorAll('[data-dir]')
) {
  const dir = button.dataset.dir;

  button.addEventListener('pointerdown', event => {
    event.preventDefault();

    keys[dir] = true;

    button.setPointerCapture(event.pointerId);
  });

  for (const type of [
    'pointerup',
    'pointercancel',
    'lostpointercapture'
  ]) {
    button.addEventListener(type, () => {
      keys[dir] = false;
    });
  }
}

$('interactBtn').onclick = interact;

$('dialog').addEventListener(
  'click',
  advanceDialogue
);

// ---------- START GAME BUTTON ----------

$('startBtn').onclick = () => {
  $('welcome').classList.add('hidden');

  running = true;

  canvas.focus();

  if (!state.tutorialDone) {
    startTutorial();
  } else {
    showToast(
      '🌸 Welcome back to Little Heart Valley!'
    );
  }
};

// ---------- RESET BUTTON ----------

$('resetBtn').onclick = resetGame;

// ---------- HINT BUTTON ----------

$('hintBtn').onclick = () => {
  showToast(
    !state.tutorialDone
      ? 'Follow the tutorial prompts!'
      : 'Explore the tulips, arcade, and pond for heart fragments.'
  );
};

// ---------- QUEST JOURNAL ----------

$('journalBtn').onclick = () => {
  const quests = $('questList');

  quests.replaceChildren();

  for (const [name, done] of [
    ['Complete the tutorial', state.tutorialDone],
    ['Collect three heart fragments', state.hearts.length === 3],
    ['Visit The Blushing Bean', state.cafeWelcomeSeen],
    ['Order a café treat', state.cafeOrders.length > 0]
  ]) {
    const entry = document.createElement('div');

    entry.className =
      `quest ${done ? 'done' : ''}`;

    entry.textContent =
      `${done ? '✓' : '○'} ${name}`;

    quests.appendChild(entry);
  }

  $('journal').classList.remove('hidden');
};

$('closeJournal').onclick = () => {
  $('journal').classList.add('hidden');
};

// ---------- PLAYER MOVEMENT ----------

function movePlayer(dt) {
  if (
    !running ||
    dialogue ||
    choiceOpen ||
    !$('journal').classList.contains('hidden')
  ) {
    return;
  }

  let dx =
    Number(keys.right) - Number(keys.left);

  let dy =
    Number(keys.down) - Number(keys.up);

  if (!dx && !dy) return;

  const length = Math.hypot(dx, dy);

  dx /= length;
  dy /= length;

  const maxX =
    state.scene === 'cafe'
      ? 770
      : WORLD_WIDTH - 24;

  const maxY =
    state.scene === 'cafe'
      ? 450
      : WORLD_HEIGHT - 24;

  state.x = Math.max(
    24,
    Math.min(
      maxX,
      state.x + dx * player.speed * dt
    )
  );

  state.y = Math.max(
    55,
    Math.min(
      maxY,
      state.y + dy * player.speed * dt
    )
  );

  state.dir =
    Math.abs(dx) > Math.abs(dy)
      ? dx > 0 ? 'right' : 'left'
      : dy > 0 ? 'down' : 'up';

  walkTick++;

  checkTutorialMovement();
}


// ---------- FLOWERS ----------

function drawFlower(x, y, color = '#f7a9c9') {
  rect(x - 2, y, 4, 11, '#4b9159');
  rect(x - 5, y - 4, 10, 8, color);
  rect(x - 2, y - 1, 4, 4, '#fff0b2');
}

// ---------- BUILDINGS ----------

function drawBuilding(x, y, w, h, name, roof, doorX) {
  rect(x, y + 36, w, h - 36, '#fff0dc');
  rect(x - 8, y + 10, w + 16, 43, roof);

  rect(
    doorX - 21,
    y + h - 50,
    42,
    50,
    '#91677c'
  );

  rect(
    doorX - 16,
    y + h - 45,
    32,
    42,
    '#dfbdab'
  );

  rect(x + 28, y + 70, 38, 36, '#9bdce3');
  rect(x + w - 66, y + 70, 38, 36, '#9bdce3');

  label(
    name,
    x + w / 2,
    y + 30,
    '#674867',
    15
  );
}

// ---------- LITTLE HEART VALLEY ----------

function drawValley(time) {
  // Grass background.
  rect(
    0,
    0,
    WORLD_WIDTH,
    WORLD_HEIGHT,
    '#a8d98e'
  );

  // Ground texture.
  for (let x = 35; x < WORLD_WIDTH; x += 85) {
    for (let y = 40; y < WORLD_HEIGHT; y += 87) {
      rect(
        x + (y % 23),
        y,
        4,
        4,
        '#91c980'
      );
    }
  }

  // Village paths.
  rect(690, 0, 220, WORLD_HEIGHT, '#e8d3ad');
  rect(0, 655, WORLD_WIDTH, 130, '#e8d3ad');
  rect(700, 440, 200, 235, '#e8d3ad');

  // Cherry blossom trees.
  const trees = [
    [90, 100],
    [360, 125],
    [1080, 120],
    [1480, 150],
    [90, 865],
    [520, 860],
    [1050, 870],
    [1500, 860]
  ];

  for (const [x, y] of trees) {
    rect(x - 8, y + 16, 16, 36, '#946f6e');

    rect(
      x - 37,
      y - 10,
      74,
      48,
      '#f1aacb'
    );

    rect(
      x - 24,
      y - 24,
      48,
      32,
      '#ffd2e3'
    );
  }

  // Main buildings.
  drawBuilding(
    615, 260, 250, 180,
    'THE BLUSHING BEAN',
    '#e9a4c2',
    738
  );

  drawBuilding(
    160, 255, 230, 175,
    'TULIP SHOP',
    '#d7a1d7',
    270
  );

  drawBuilding(
    1180, 250, 240, 175,
    'PIXEL ARCADE',
    '#a6a0db',
    1300
  );

  // Secret pond.
  rect(
    1130, 745, 230, 150,
    '#82c6df'
  );

  rect(
    1150, 765, 190, 110,
    '#a8e0ee'
  );

  label(
    'SECRET POND',
    1245,
    728
  );

  // Flower beds.
  for (let i = 0; i < 10; i++) {
    drawFlower(
      180 + i * 30,
      540 + (i % 2) * 18,
      '#8cafe9'
    );

    drawFlower(
      430 + i * 19,
      610 + (i % 2) * 20
    );
  }

  // Tutorial welcome sign.
  rect(
    766, 640, 68, 42,
    '#b58d6b'
  );

  rect(
    775, 647, 50, 26,
    '#fff0cc'
  );

  label(
    'WELCOME',
    800,
    664,
    '#7d5276',
    10
  );

  // Glowing tutorial sign.
  if (tutorialStage === 'sign') {
    const pulse = Math.sin(time / 250) * 7;

    ctx.strokeStyle = '#fff7b8';
    ctx.lineWidth = 4;

    ctx.strokeRect(
      760 - pulse / 2,
      634 - pulse / 2,
      80 + pulse,
      54 + pulse
    );
  }

  // Heart fragments.
  for (const heart of hearts) {
    if (state.hearts.includes(heart.id)) {
      continue;
    }

    label(
      '♥',
      heart.x,
      heart.y,
      '#ee75a4',
      33
    );
  }

  // Faceless villagers.
  const villagers = [
    [300, 340, '#a1b9df'],
    [1280, 340, '#d5a4e8']
  ];

  for (const [x, y, color] of villagers) {
    rect(
      x - 11,
      y - 28,
      22,
      29,
      color
    );

    rect(
      x - 9,
      y - 43,
      18,
      16,
      '#e7c7ad'
    );
  }

  // Pond completion sparkle.
  if (state.hearts.length === 3) {
    label(
      '✨',
      1240,
      835,
      '#fff1a8',
      25
    );
  }
}

// ---------- THE BLUSHING BEAN INTERIOR ----------

function drawCafe(time) {
  // Wooden floor.
  rect(
    0, 0, 800, 480,
    '#e7c6ad'
  );

  for (let y = 0; y < 480; y += 28) {
    rect(
      0, y, 800, 2,
      '#d8b297'
    );
  }

  // Pink walls.
  rect(
    0, 0, 800, 115,
    '#f9dce8'
  );

  rect(
    0, 110, 800, 12,
    '#bc8da9'
  );

  label(
    'THE BLUSHING BEAN ☕',
    400,
    40,
    '#9c5f89',
    24
  );

  // Windows.
  rect(
    85, 52, 120, 54,
    '#9bd7df'
  );

  rect(
    600, 52, 120, 54,
    '#9bd7df'
  );

  // Hanging plants.
  for (const x of [110, 660]) {
    rect(
      x, 94, 36, 12,
      '#ae806c'
    );

    rect(
      x + 8, 76, 20, 18,
      '#78ae78'
    );
  }

  // Main counter.
  rect(
    255, 140, 290, 82,
    '#a87966'
  );

  rect(
    255, 140, 290, 16,
    '#f6d2bb'
  );

  // Pastry display.
  rect(
    145, 155, 90, 66,
    '#b1dbe2'
  );

  rect(
    153, 167, 74, 8,
    '#fff3ec'
  );

  label(
    '🍰',
    190,
    197,
    '#a16a84',
    26
  );

  // Espresso machine.
  rect(
    560, 150, 65, 65,
    '#ac8a9d'
  );

  rect(
    570, 164, 45, 12,
    '#e9d8df'
  );

  // Café tables and chairs.
  for (const x of [155, 650]) {
    rect(
      x - 40, 295, 80, 45,
      '#b98270'
    );

    rect(
      x - 55, 300, 16, 35,
      '#d8a1bb'
    );

    rect(
      x + 40, 300, 16, 35,
      '#d8a1bb'
    );

    label(
      '☕',
      x,
      320,
      '#fff1dd',
      20
    );
  }

  // Blue tulips.
  for (let i = 0; i < 3; i++) {
    drawFlower(
      590 + i * 13,
      205,
      '#84a8ef'
    );
  }

  // Music box.
  rect(
    730, 245, 38, 28,
    '#b58eae'
  );

  label(
    '♫',
    748,
    263,
    '#fff0d5',
    19
  );

  // Front exit.
  rect(
    350, 458, 100, 22,
    '#8f718a'
  );

  label(
    'EXIT ↓',
    400,
    451,
    '#77556f',
    14
  );

  // Developer NPC behind the counter.
  drawCharacter(
    400,
    135 + Math.sin(time / 500) * 2,
    'dev',
    'down',
    false
  );

  // Occasional floating music note.
  if (time % 4500 < 700) {
    label(
      '♪',
      444,
      83,
      '#cf81ad',
      19
    );
  }
}

// ---------- CAMERA AND RENDERING ----------

function render(time) {
  const camX =
    state.scene === 'valley'
      ? Math.max(
          0,
          Math.min(
            WORLD_WIDTH - 800,
            state.x - 400
          )
        )
      : 0;

  const camY =
    state.scene === 'valley'
      ? Math.max(
          0,
          Math.min(
            WORLD_HEIGHT - 480,
            state.y - 240
          )
        )
      : 0;

  ctx.save();

  ctx.translate(
    -Math.round(camX),
    -Math.round(camY)
  );

  if (state.scene === 'cafe') {
    drawCafe(time);
  } else {
    drawValley(time);
  }

  const moving =
    Object.values(keys).some(Boolean) &&
    !dialogue &&
    !choiceOpen;

  drawCharacter(
    state.x,
    state.y,
    'greg',
    state.dir,
    moving
  );

  ctx.restore();
}

// ---------- MAIN GAME LOOP ----------

function frame(time) {
  const dt = Math.min(
    (time - (lastFrame || time)) / 1000,
    0.05
  );

  lastFrame = time;

  movePlayer(dt);
  render(time);

  requestAnimationFrame(frame);
}

// ---------- INITIALIZE GAME ----------

updateUI();
requestAnimationFrame(frame);
