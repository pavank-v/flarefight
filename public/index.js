const mapImage = new Image();
const santaImage = new Image();
const speakerImage = new Image();
const footStepAudio = new Audio("walking_sound.mp3");

mapImage.src = "./game_map.png";
santaImage.src = "./player_image.png";
speakerImage.src = "./speaker.png";
footStepAudio.loop = true;

const canvasEle = document.getElementById("canvas");
canvasEle.width = window.innerWidth;
canvasEle.height = window.innerHeight;

const canvas = canvasEle.getContext('2d');
const socket = io("ws://localhost:3000");

const TILES_IN_ROW = 8;
const TILE_SIZE = 32;
const PROJECTILE_RADIUS = 5;

let groundMap = [[]];
let decalMap = [[]];
let players = [];
let projectiles = [];
let isPlaying = true;

const inputs = {
	up: false,
	down: false,
	right: false,
	left: false
};

const uid = Math.floor(Math.random() * 100000);

const options = {
	appid: "0f53835609414874a7cbfe9d28e0f1be",
	channel: "game",
	uid,
	token: null,
};

const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

const localTracks = {
	audioTrack: null,
};

const remoteUsers = {};
const muteButton = document.getElementById("mute");

socket.on("connect", () => {
	console.log("connected")
})

socket.on("map", (loadedMap) => {
	groundMap = loadedMap.ground;
	decalMap = loadedMap.decal;
});

socket.on("players", (serverPlayers) => {
	players = serverPlayers;
});

socket.on("projectiles", (serverProjectiles) => {
	projectiles = serverProjectiles;
});

const isMoving = () => {
	return inputs.left || inputs.right || inputs.up || inputs.down;
};

async function subscribe(user, mediaType) {
  await client.subscribe(user, mediaType);
  if (mediaType === "audio") {
    user.audioTrack.play();
  }
}

function handleUserPublished(user, mediaType) {
  const id = user.uid;
  remoteUsers[id] = user;
  subscribe(user, mediaType);
}

function handleUserUnpublished(user) {
  const id = user.uid;
  delete remoteUsers[id];
}

async function join() {
	socket.emit("voiceId", uid);

  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", handleUserUnpublished);

	[options.uid, localTracks.audioTrack] = await Promise.all([
		client.join(options.appid, options.channel, options.token || null, uid),
		AgoraRTC.createMicrophoneAudioTrack(),
	]);

  await client.publish(Object.values(localTracks));
	console.log("Publish success")
}

join();

muteButton.addEventListener("click", () => {
	if (isPlaying) {
		localTracks.audioTrack.setEnabled(false);
		muteButton.innerText = "unmute";
		socket.emit("mute", true);
	}
	else {
		localTracks.audioTrack.setEnabled(true);
		muteButton.innerText = "mute";
		socket.emit("mute", false);
	}

	isPlaying = !isPlaying;
});

window.addEventListener("keydown", (e) => {
	if (e.key === 'a' || e.key === "ArrowLeft")
		inputs["left"] = true;
	else if (e.key === 's' || e.key === "ArrowDown")
		inputs["down"] = true;
	else if (e.key === 'w' || e.key === "ArrowUp")
		inputs["up"] = true;
	else if (e.key === 'd' || e.key === "ArrowRight")
		inputs["right"] = true;

	if (isMoving() && footStepAudio.paused) {
		footStepAudio.currentTime = 0;
		footStepAudio.play();
	}

	socket.emit("inputs", inputs);
});

window.addEventListener("keyup", (e) => {
	if (e.key === 'a' || e.key === "ArrowLeft")
		inputs["left"] = false;
	else if (e.key === 's' || e.key === "ArrowDown")
		inputs["down"] = false;
	else if (e.key === 'w' || e.key === "ArrowUp")
		inputs["up"] = false;
	else if (e.key === 'd' || e.key === "ArrowRight")
		inputs["right"] = false;

	if (isMoving()) {
		footStepAudio.pause();
		footStepAudio.currentTime = 0;
	}

	socket.emit("inputs", inputs);
});

window.addEventListener("click", (e) => {
	const angle = Math.atan2(
		e.clientY - canvasEle.height / 2,
		e.clientX - canvasEle.width / 2
	);

	socket.emit("projectiles", angle);
});

const loop = () => {
	canvas.clearRect(0, 0, canvasEle.width, canvasEle.height);
	let cameraX = 0;
	let cameraY = 0;

	const myPlayer = players.find((player) => player.id === socket.id);
	if (myPlayer) {
		cameraX = parseInt(myPlayer.x - canvasEle.width / 2);
		cameraY = parseInt(myPlayer.y - canvasEle.height / 2);
	}

	for (let r = 0; r < groundMap.length; r++) {
		for (let c = 0; c < groundMap[0].length; c++) {
			const { id } = groundMap[r][c];
			const imageRow = parseInt(id / TILES_IN_ROW);
			const imageCol = id % TILES_IN_ROW;

			canvas.drawImage(
				mapImage,
				imageCol * TILE_SIZE,
				imageRow * TILE_SIZE,
				TILE_SIZE,
				TILE_SIZE,
				c * TILE_SIZE - cameraX,
				r * TILE_SIZE - cameraY,
				TILE_SIZE,
				TILE_SIZE
			);
		}
	}

	for (let r = 0; r < decalMap.length; r++) {
		for (let c = 0; c < decalMap[0].length; c++) {
			const { id } = decalMap[r][c] ?? 0;
			if (!id) continue;

			const imageRow = parseInt(id / TILES_IN_ROW);
			const imageCol = id % TILES_IN_ROW;

			canvas.drawImage(
				mapImage,
				imageCol * TILE_SIZE,
				imageRow * TILE_SIZE,
				TILE_SIZE,
				TILE_SIZE,
				c * TILE_SIZE - cameraX,
				r * TILE_SIZE - cameraY,
				TILE_SIZE,
				TILE_SIZE
			);
		}
	}

	for (const player of players) {
		canvas.drawImage(santaImage, player.x - cameraX, player.y - cameraY);

		if (!player.isMuted) {
			canvas.drawImage(speakerImage, player.x - cameraX + 5, player.y - cameraY - 28);
		}
		
		if (player !== myPlayer) {
			const voice = remoteUsers[player.voiceId];

			if (voice && voice.audioTrack) {
				const distance = Math.sqrt(
					(player.x - myPlayer.x) ** 2 + (player.y - myPlayer.y) ** 2
				);
				const ratio = 1.0 - Math.floor(distance / 700, 1);
				voice.audioTrack.setVolume(
					Math.floor(ratio * 100)
				);
			}
		}
	}

	for (const projectile of projectiles) {
		canvas.fillStyle = "#000000";
		canvas.beginPath();
		canvas.arc(
			projectile.x - cameraX,
			projectile.y - cameraY,
			PROJECTILE_RADIUS,
			0,
			2 * Math.PI
		);
		canvas.fill();
	}

	window.requestAnimationFrame(loop);
}

window.requestAnimationFrame(loop);