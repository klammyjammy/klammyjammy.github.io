/**
 * Fish Wheelspin — main.js
 *
 * Loads fish data from fish_data.json (place in the same folder).
 * Falls back to PLACEHOLDER_FISH if the file is missing, so the
 * site works out-of-the-box before your real data is ready.
 */

// ─── Confetti ─────────────────────────────────────────────────────────────────

function launchConfetti() {
	if (typeof confetti === 'undefined') return;

	// Palette colours matching the site theme
	const colors = ['#A07CC5', '#7B4FA6', '#5BBCCC', '#3A8FA0', '#FFFFFF', '#1E2A6E'];

	// Two cannons firing from bottom-left and bottom-right
	confetti({
		particleCount: 100,
		angle: 60,
		spread: 55,
		origin: { x: 0, y: 1 },
		colors,
		startVelocity: 80,
		gravity: 0.8,
		ticks: 200,
	});

	confetti({
		particleCount: 100,
		angle: 120,
		spread: 55,
		origin: { x: 1, y: 1 },
		colors,
		startVelocity: 80,
		gravity: 0.8,
		ticks: 200,
	});
}

// ─── Sound ────────────────────────────────────────────────────────────────────

const SPIN_SOUNDS = [
	{ id: 'spin-microwave', label: 'Microwave', file: 'sounds/spin-microwave.mp3' },
	{ id: 'spin-train', label: 'Train', file: 'sounds/spin-train.mp3' },
	{ id: 'spin-elevator', label: 'Elevator', file: 'sounds/spin-elevator.mp3' },
	{ id: 'spin-fishing', label: 'Fishing', file: 'sounds/spin-fishing.mp3' },
	{ id: 'spin-choir', label: 'Choir', file: 'sounds/spin-choir.mp3' },
	{ id: 'spin-zelda', label: 'Zelda', file: 'sounds/spin-zelda.mp3' },
];

const WIN_SOUNDS = [
	{ id: 'win-microwave', label: 'Microwave', file: 'sounds/win-microwave.mp3' },
	{ id: 'win-train', label: 'Train', file: 'sounds/win-train.mp3' },
	{ id: 'win-elevator', label: 'Elevator', file: 'sounds/win-elevator.mp3' },
	{ id: 'win-fishing', label: 'Fishing', file: 'sounds/win-fishing.mp3' },
	{ id: 'win-choir', label: 'Choir', file: 'sounds/win-choir.mp3' },
	{ id: 'win-zelda', label: 'Zelda', file: 'sounds/win-zelda.mp3' },
];

let selectedSpinSound = SPIN_SOUNDS[0];
let selectedWinSound = WIN_SOUNDS[0];
let muted = false;

let spinAudio = null;  // currently playing spin loop

function preloadAudio(file) {
	const a = new Audio(file);
	a.preload = 'auto';
	return a;
}

function playSpinLoop() {
	if (muted) return;
	stopSpinLoop();
	spinAudio = preloadAudio(selectedSpinSound.file);
	spinAudio.loop = true;
	spinAudio.volume = 0.5;
	spinAudio.play().catch(() => { });
}

function stopSpinLoop() {
	if (spinAudio) {
		spinAudio.pause();
		spinAudio.currentTime = 0;
		spinAudio = null;
	}
}

function playWinSound() {
	if (muted) return;
	const a = preloadAudio(selectedWinSound.file);
	a.volume = 0.7;
	a.play().catch(() => { });
}

// ─── Sound modal ──────────────────────────────────────────────────────────────

function buildSoundOptions(containerId, sounds, selectedId, onSelect) {
	const container = document.getElementById(containerId);
	container.innerHTML = '';
	sounds.forEach(sound => {
		const btn = document.createElement('button');
		btn.className = 'sound-option' + (sound.id === selectedId ? ' selected' : '');
		btn.textContent = sound.label;
		btn.onclick = () => {
			onSelect(sound);
			buildSoundOptions(containerId, sounds, sound.id, onSelect);
		};
		container.appendChild(btn);
	});
}

function openSoundModal() {
	buildSoundOptions('spinSoundOptions', SPIN_SOUNDS, selectedSpinSound.id, s => { selectedSpinSound = s; });
	buildSoundOptions('winSoundOptions', WIN_SOUNDS, selectedWinSound.id, s => { selectedWinSound = s; });
	document.getElementById('muteToggle').checked = muted;
	document.getElementById('soundModal').classList.add('open');
	document.getElementById('soundModalOverlay').classList.add('open');
}

function closeSoundModal() {
	document.getElementById('soundModal').classList.remove('open');
	document.getElementById('soundModalOverlay').classList.remove('open');
}

function toggleMute() {
	muted = document.getElementById('muteToggle').checked;
	if (muted) stopSpinLoop();
}

// ─── Placeholder data (swap out once fish_data.json is ready) ────────────────

const PLACEHOLDER_FISH = [
];

// ─── Emoji fallback map ───────────────────────────────────────────────────────

const FISH_EMOJI = ["🐟"];

function fishEmoji(name) {
	let h = 0;
	for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
	return FISH_EMOJI[h % FISH_EMOJI.length];
}

// ─── State ────────────────────────────────────────────────────────────────────

let FISH = [];
let spinning = false;
let hasSpun = false;

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const track = document.getElementById('slotTrack');
const winnerFrame = document.getElementById('winnerFrame');
const spinBtn = document.getElementById('spinBtn');
const resultCard = document.getElementById('resultCard');
const resultImg = document.getElementById('resultImg');
const resultImgFallback = document.getElementById('resultImgFallback');
const resultName = document.getElementById('resultName');
const resultDesc = document.getElementById('resultDesc');
const resultSummary = document.getElementById('resultSummary');
const resultLink = document.getElementById('resultLink');
const resultLinkINaturalist = document.getElementById('resultLinkINaturalist');
const fishCount = document.getElementById('fishCount');
const siteHeader = document.querySelector('.site-header');
const slotStage = document.querySelector('.slot-stage');

// ─── Config ───────────────────────────────────────────────────────────────────

const ITEM_H = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--item-h')) || 100;
const VISIBLE = 3;
const WINDOW_H = ITEM_H * VISIBLE;
const SPIN_DURATION = 60000; // ms
const PRE_ITEMS = 1000;   // items before the winner in the sequence
const POST_ITEMS = 2;    // items after the winner

// ─── Build a single slot item element ────────────────────────────────────────

function buildSlotItem(fish, idx) {
	const el = document.createElement('div');
	el.className = 'slot-item';

	const thumbEl = document.createElement('div');
	thumbEl.className = 'slot-item__thumb';

	if (fish.image_url) {
		const img = document.createElement('img');
		img.src = fish.image_url;
		img.alt = fish.name;
		img.loading = 'lazy';
		img.onerror = () => {
			thumbEl.innerHTML = '';
			thumbEl.textContent = fishEmoji(fish.name);
		};
		thumbEl.appendChild(img);
	} else {
		thumbEl.textContent = fishEmoji(fish.name);
	}

	const textEl = document.createElement('div');
	textEl.className = 'slot-item__text';

	const nameEl = document.createElement('div');
	nameEl.className = 'slot-item__name';
	nameEl.textContent = fish.name;

	const descEl = document.createElement('div');
	descEl.className = 'slot-item__desc';
	descEl.textContent = fish.description || '';

	textEl.appendChild(nameEl);
	textEl.appendChild(descEl);
	el.appendChild(thumbEl);
	el.appendChild(textEl);

	return el;
}

// ─── Populate the track with a sequence of fish ───────────────────────────────

function buildTrack(sequence) {
	track.innerHTML = '';
	const fragment = document.createDocumentFragment();
	sequence.forEach((fish, i) => fragment.appendChild(buildSlotItem(fish, i)));
	track.appendChild(fragment);
}

// ─── Easing ───────────────────────────────────────────────────────────────────

function easeOutQuart(t) {
	return 1 - Math.pow(1 - t, 2);
}

// ─── Show the result card ─────────────────────────────────────────────────────

function showResult(fish) {
	if (fish.image_url) {
		resultImg.src = fish.image_url;
		resultImg.alt = fish.name;
		resultImg.style.display = 'block';
		resultImgFallback.textContent = '';
		resultImgFallback.style.display = 'none';
		resultImg.onerror = () => {
			resultImg.style.display = 'none';
			resultImgFallback.textContent = fishEmoji(fish.name);
			resultImgFallback.style.display = 'flex';
		};
	} else {
		resultImg.style.display = 'none';
		resultImgFallback.textContent = fishEmoji(fish.name);
		resultImgFallback.style.display = 'flex';
	}

	resultName.textContent = fish.name;
	resultDesc.textContent = fish.description || '';
	resultSummary.textContent = fish.summary || 'No information available.';

	if (fish.wiki_url) {
		resultLink.href = fish.wiki_url;
		resultLink.style.display = 'inline-flex';
	} else {
		resultLink.style.display = 'none';
	}

	if (fish.inaturalist_url) {
		resultLinkINaturalist.href = fish.inaturalist_url;
		resultLinkINaturalist.style.display = 'inline-flex';
	} else {
		resultLinkINaturalist.style.display = 'none';
	}

	resultCard.classList.add('visible');
}

// ─── View transitions ────────────────────────────────────────────────────────

function showSpinView() {
	// siteHeader.classList.remove('hidden');
	slotStage.classList.remove('hidden');
	resultCard.classList.remove('visible');
	winnerFrame.classList.remove('visible', 'flash');
	spinBtn.textContent = 'Spin!';
	hasSpun = false;
}

function showResultView() {
	// siteHeader.classList.add('hidden');
	slotStage.classList.add('hidden');
	spinBtn.textContent = 'Spin again';
	hasSpun = true;
}

// ─── Main spin function ───────────────────────────────────────────────────────

function spin() {
	if (hasSpun) { showSpinView(); return; }
	if (spinning || FISH.length === 0) return;
	spinning = true;
	spinBtn.disabled = true;
	resultCard.classList.remove('visible');
	winnerFrame.classList.remove('visible', 'flash');

	// Pick a random winner
	const winnerIdx = Math.floor(Math.random() * FISH.length);
	const winner = FISH[winnerIdx];

	// Build the scroll sequence: random items → winner → random tail
	const sequence = [];
	for (let i = 0; i < PRE_ITEMS; i++) {
		sequence.push(FISH[Math.floor(Math.random() * FISH.length)]);
	}
	sequence.push(winner);
	for (let i = 0; i < POST_ITEMS; i++) {
		sequence.push(FISH[Math.floor(Math.random() * FISH.length)]);
	}

	buildTrack(sequence);
	playSpinLoop();

	// The track starts so the first item is centred in the window
	const startY = WINDOW_H / 2 - ITEM_H / 2;
	// End position: winner (at PRE_ITEMS index) is centred
	const endY = startY - PRE_ITEMS * ITEM_H;

	track.style.transition = 'none';
	track.style.transform = `translateY(${startY}px)`;

	const totalDist = Math.abs(endY - startY);
	let startTime = null;

	function step(ts) {
		if (!startTime) startTime = ts;
		const elapsed = ts - startTime;
		const progress = Math.min(elapsed / SPIN_DURATION, 1);
		const eased = easeOutQuart(progress);
		const y = startY - eased * totalDist;

		track.style.transform = `translateY(${y}px)`;

		if (progress < 1) {
			requestAnimationFrame(step);
		} else {
			// Snap to exact final position
			track.style.transform = `translateY(${endY}px)`;
			onSpinComplete(winner);
		}
	}

	requestAnimationFrame(step);
}

function onSpinComplete(winner) {
	// Flash the winner frame
	winnerFrame.classList.add('visible', 'flash');

	// Remove the flash class after animation ends, keep visible
	winnerFrame.addEventListener('animationend', () => {
		winnerFrame.classList.remove('flash');
	}, { once: true });

	launchConfetti();
	stopSpinLoop();
	playWinSound();

	// Show result card and fire confetti after a short pause
	setTimeout(() => {
		showResult(winner);
		// Then smoothly hide the slot + header
		setTimeout(() => {
			showResultView();
			spinning = false;
			spinBtn.disabled = false;
		}, 0);
	}, 1000);
}

// ─── Data loading ─────────────────────────────────────────────────────────────

async function loadFishData() {
	try {
		const res = await fetch('fish_data.json');
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const data = await res.json();

		// Filter out any entries with no useful data
		FISH = data.filter(f => f.name && (f.summary || f.description));

		if (FISH.length === 0) throw new Error('No valid fish entries found');

		console.log(`Loaded ${FISH.length} fish from fish_data.json`);
		fishCount.textContent = `${FISH.length} fish in the pool`;

	} catch (err) {
		console.warn('Could not load fish_data.json, using placeholder data.', err.message);
		FISH = PLACEHOLDER_FISH;
		fishCount.textContent = `${FISH.length} fish (placeholder data)`;
	}

	// Initialise the track display
	initTrack();
}

// ─── Initialise the visible track (idle state) ───────────────────────────────

function initTrack() {
	// Show a random slice of fish as the initial idle state
	const sample = [];
	const shuffled = [...FISH].sort(() => Math.random() - 0.5);
	for (let i = 0; i < Math.min(VISIBLE + 2, shuffled.length); i++) {
		sample.push(shuffled[i]);
	}

	buildTrack(sample);
	// Centre the middle item
	track.style.transition = 'none';
	track.style.transform = `translateY(${WINDOW_H / 2 - ITEM_H / 2}px)`;
}

// ─── Wire up button ───────────────────────────────────────────────────────────

spinBtn.addEventListener('click', spin);

// ─── Boot ─────────────────────────────────────────────────────────────────────

loadFishData();
