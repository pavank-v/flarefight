const mapImage = new Image();
const playerImage = new Image();
const speakerImage = new Image();
const projectileImage = new Image();
const footStepAudio = new Audio("./assets/walking_sound.mp3");

mapImage.src = "./assets/game_map.png";
playerImage.src = "./assets/player_image.png";
speakerImage.src = "./assets/speaker.png";
projectileImage.src = "./assets/projectile_image.png";
footStepAudio.loop = true;

const canvasEle = document.getElementById("canvas");
canvasEle.width = window.innerWidth;
canvasEle.height = window.innerHeight;

const ctx = canvasEle.getContext('2d');
const socket = io();

const TILES_IN_ROW = 8;
const TILE_SIZE = 32;
const PLAYER_SIZE = 32;

let groundMap = [[]];
let decalMap = [[]];
let players = [];
let projectiles = [];
let isPlaying = true;
let gameStarted = false;
let gameState = "playing";
let winnerData = null;

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
const nameModal = document.getElementById("nameModal");
const nameInput = document.getElementById("nameInput");
const joinButton = document.getElementById("joinButton");

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

socket.on("gameState", (state) => {
  gameState = state;
});

socket.on("playerScored", (data) => {
  console.log(`${data.shooterName} hit ${data.victimName}! Score: ${data.newScore}`);
});

socket.on("gameWon", (data) => {
  gameState = "ended";
  winnerData = data;
  console.log(`${data.winnerName} wins with ${data.finalScores.find(p => p.id === data.winnerId).score} points!`);
});

socket.on("gameReset", () => {
  gameState = "playing";
  winnerData = null;
  console.log("Game reset!");
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

  try {
    [options.uid, localTracks.audioTrack] = await Promise.all([
      client.join(options.appid, options.channel, options.token || null, uid),
      AgoraRTC.createMicrophoneAudioTrack(),
    ]);

    await client.publish(Object.values(localTracks));
    console.log("Publish success");
  } catch (error) {
    console.error("Voice chat error:", error);
  }
}

joinButton.addEventListener("click", () => {
  const playerName = nameInput.value.trim();
  if (playerName.length > 0) {
    socket.emit("joinGame", playerName);
    nameModal.style.display = "none";
    gameStarted = true;
    join();
  }
});

nameInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    joinButton.click();
  }
});

muteButton.addEventListener("click", () => {
  if (!localTracks.audioTrack) return;

  if (isPlaying) {
    localTracks.audioTrack.setEnabled(false);
    muteButton.innerText = "UNMUTE";
    socket.emit("mute", true);
  } else {
    localTracks.audioTrack.setEnabled(true);
    muteButton.innerText = "MUTE";
    socket.emit("mute", false);
  }

  isPlaying = !isPlaying;
});

window.addEventListener("keydown", (e) => {
  if (!gameStarted || gameState !== "playing") return;

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
  if (!gameStarted) return;

  if (e.key === 'a' || e.key === "ArrowLeft")
    inputs["left"] = false;
  else if (e.key === 's' || e.key === "ArrowDown")
    inputs["down"] = false;
  else if (e.key === 'w' || e.key === "ArrowUp")
    inputs["up"] = false;
  else if (e.key === 'd' || e.key === "ArrowRight")
    inputs["right"] = false;

  if (!isMoving()) {
    footStepAudio.pause();
    footStepAudio.currentTime = 0;
  }

  socket.emit("inputs", inputs);
});

window.addEventListener("click", (e) => {
  if (!gameStarted || gameState !== "playing") return;

	const rect = canvasEle.getBoundingClientRect();
  const angle = Math.atan2(
    e.clientY - canvasEle.height / 2 - rect.left,
    e.clientX - canvasEle.width / 2 - rect.top
  );

  socket.emit("projectiles", angle);
});

function drawScoreboard() {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const myPlayer = players.find((player) => player.id === socket.id);

  const scrollWidth = 280;
  const scrollHeight = Math.min(400, 60 + sortedPlayers.length * 35);
  const scrollX = 20;
  const scrollY = 20;

  ctx.fillStyle = "rgba(20, 15, 10, 0.95)";
  ctx.fillRect(scrollX, scrollY, scrollWidth, scrollHeight);

  ctx.strokeStyle = "#8B7355";
  ctx.lineWidth = 4;
  ctx.strokeRect(scrollX, scrollY, scrollWidth, scrollHeight);

  ctx.fillStyle = "#D4AF37";
  ctx.strokeStyle = "#8B7355";
  ctx.lineWidth = 2;

  ctx.fillRect(scrollX - 8, scrollY + 15, 15, 15);
  ctx.strokeRect(scrollX - 8, scrollY + 15, 15, 15);
  ctx.fillRect(scrollX + scrollWidth - 7, scrollY + 15, 15, 15);
  ctx.strokeRect(scrollX + scrollWidth - 7, scrollY + 15, 15, 15);

  ctx.fillRect(scrollX - 8, scrollY + scrollHeight - 30, 15, 15);
  ctx.strokeRect(scrollX - 8, scrollY + scrollHeight - 30, 15, 15);
  ctx.fillRect(scrollX + scrollWidth - 7, scrollY + scrollHeight - 30, 15, 15);
  ctx.strokeRect(scrollX + scrollWidth - 7, scrollY + scrollHeight - 30, 15, 15);

  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 20px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillText("SCOREBOARD", scrollX + scrollWidth / 2, scrollY + 35);

  ctx.font = "16px 'Courier New', monospace";
  ctx.textAlign = "left";

  sortedPlayers.forEach((player, index) => {
    const y = scrollY + 65 + index * 35;
    const isMe = myPlayer && player.id === myPlayer.id;

    if (isMe) {
      ctx.fillStyle = "rgba(255, 215, 0, 0.2)";
      ctx.fillRect(scrollX + 10, y - 20, scrollWidth - 20, 28);
    }

    ctx.fillStyle = index === 0 ? "#FFD700" : (index === 1 ? "#C0C0C0" : (index === 2 ? "#CD7F32" : "#DDD"));
    
    const displayName = player.name.length > 15 ? player.name.substring(0, 12) + "..." : player.name;
    ctx.fillText(`${index + 1}. ${displayName}`, scrollX + 20, y);

    ctx.textAlign = "right";
    ctx.fillText(`${player.score}`, scrollX + scrollWidth - 20, y);
    ctx.textAlign = "left";
  });
}

function drawWinScreen() {
  if (!winnerData) return;

  ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
  ctx.fillRect(0, 0, canvasEle.width, canvasEle.height);

  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 60px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillText("VICTORY!", canvasEle.width / 2, canvasEle.height / 2 - 100);

  ctx.fillStyle = "#FFF";
  ctx.font = "bold 36px 'Courier New', monospace";
  ctx.fillText(`${winnerData.winnerName} WINS!`, canvasEle.width / 2, canvasEle.height / 2 - 30);

  ctx.font = "24px 'Courier New', monospace";
  ctx.fillStyle = "#CCC";
  ctx.fillText("Game restarting...", canvasEle.width / 2, canvasEle.height / 2 + 80);

  const sortedScores = [...winnerData.finalScores].sort((a, b) => b.score - a.score);
  ctx.font = "18px 'Courier New', monospace";
  ctx.fillStyle = "#AAA";
  ctx.textAlign = "left";
  
  sortedScores.slice(0, 5).forEach((player, index) => {
    const y = canvasEle.height / 2 + 140 + index * 30;
    const medal = index === 0 ? "🥇" : (index === 1 ? "🥈" : (index === 2 ? "🥉" : ""));
    ctx.fillText(`${medal} ${player.name}: ${player.score}`, canvasEle.width / 2 - 150, y);
  });
}

function drawPlayerName(player, cameraX, cameraY) {
  ctx.textAlign = "center";
  ctx.fillStyle = "#FFF";
  ctx.fillText(player.name, player.x - cameraX + PLAYER_SIZE / 2, player.y - cameraY + 50);
}

const loop = () => {
  ctx.clearRect(0, 0, canvasEle.width, canvasEle.height);
  
  if (!gameStarted) {
    window.requestAnimationFrame(loop);
    return;
  }

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

      ctx.drawImage(
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
      const tile = decalMap[r][c];
      if (!tile) continue;
      
      const { id } = tile;
      if (!id) continue;

      const imageRow = parseInt(id / TILES_IN_ROW);
      const imageCol = id % TILES_IN_ROW;

      ctx.drawImage(
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
    ctx.drawImage(playerImage, player.x - cameraX, player.y - cameraY);

    drawPlayerName(player, cameraX, cameraY);

    if (!player.isMuted) {
      ctx.drawImage(speakerImage, player.x - cameraX + 5, player.y - cameraY - 28);
    }

    if (myPlayer && player.id !== myPlayer.id) {
      const voice = remoteUsers[player.voiceId];

      if (voice && voice.audioTrack) {
        const distance = Math.sqrt(
          (player.x - myPlayer.x) ** 2 + (player.y - myPlayer.y) ** 2
        );
        const ratio = Math.max(0, 1.0 - distance / 700);
        voice.audioTrack.setVolume(Math.floor(ratio * 100));
      }
    }
  }

  for (const projectile of projectiles) {
    ctx.drawImage(
      projectileImage,
      projectile.x - cameraX,
      projectile.y - cameraY,
    );
  }

  drawScoreboard();

  if (gameState === "ended") {
    drawWinScreen();
  }

  window.requestAnimationFrame(loop);
};

window.requestAnimationFrame(loop);