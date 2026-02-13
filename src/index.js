const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const LoadMap = require("./map_loader");
require('dotenv').config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const TICK_RATE = 30;
const PLAYER_SPEED = 11;
const PROJECTILE_SPEED = 15;
const PLAYER_SIZE = 32;
const TILE_SIZE = 32;
const WIN_SCORE = 50;
const RESET_DELAY = 5000;

let players = [];
let projectiles = [];
let inputsMap = {};
let ground2D, decal2D;
let gameState = "playing";

const isColliding = (rect1, rect2) => {
  return (
    rect1.x < rect2.x + rect2.w &&
    rect1.x + rect1.w > rect2.x &&
    rect1.y < rect2.y + rect2.h &&
    rect1.h + rect1.y > rect2.y
  );
};

const isCollidingWithObjects = (player) => {
  for (let r = 0; r < decal2D.length; r++) {
    for (let c = 0; c < decal2D[0].length; c++) {
      const decalTile = decal2D[r][c] ?? undefined;

      if (decalTile && isColliding(
        {
          x: player.x,
          y: player.y,
          h: PLAYER_SIZE,
          w: PLAYER_SIZE,
        },
        {
          x: c * TILE_SIZE,
          y: r * TILE_SIZE,
          h: TILE_SIZE,
          w: TILE_SIZE,
        }
      ))
        return true;
    }
  }
  return false;
};

const checkWinCondition = () => {
  const winner = players.find(player => player.score >= WIN_SCORE);
  if (winner && gameState === "playing") {
    gameState = "ended";
    io.emit("gameWon", { 
      winnerId: winner.id, 
      winnerName: winner.name,
      finalScores: players.map(p => ({ id: p.id, name: p.name, score: p.score }))
    });

    setTimeout(() => {
      resetGame();
    }, RESET_DELAY);
  }
};

const resetGame = () => {
  players.forEach(player => {
    player.score = 0;
    player.x = 400;
    player.y = 400;
  });
  projectiles = [];
  gameState = "playing";
  io.emit("gameReset");
};

const tick = (delta) => {
  if (gameState !== "playing") return;

  for (const player of players) {
    const input = inputsMap[player.id];
    if (!input) continue;

    const previousX = player.x;
    const previousY = player.y;

    if (input.up)
      player.y -= PLAYER_SPEED;
    else if (input.down)
      player.y += PLAYER_SPEED;

    if (isCollidingWithObjects(player))
      player.y = previousY;

    if (input.right)
      player.x += PLAYER_SPEED;
    else if (input.left)
      player.x -= PLAYER_SPEED;

    if (isCollidingWithObjects(player))
      player.x = previousX;
  }

  for (const projectile of projectiles) {
    projectile.x += Math.cos(projectile.angle) * PROJECTILE_SPEED;
    projectile.y += Math.sin(projectile.angle) * PROJECTILE_SPEED;
    projectile.timeLeft -= delta;

    for (const player of players) {
      if (player.id === projectile.playerId) continue;

      const distance = Math.sqrt(
        ((player.x + PLAYER_SIZE / 2 - projectile.x) ** 2) +
        ((player.y + PLAYER_SIZE / 2 - projectile.y) ** 2)
      );

      if (distance <= PLAYER_SIZE / 2) {
        player.x = 400;
        player.y = 400;
        projectile.timeLeft = 0;

        const shooter = players.find(p => p.id === projectile.playerId);
        if (shooter) {
          shooter.score += 1;
          io.emit("playerScored", { 
            shooterId: shooter.id, 
            shooterName: shooter.name,
            victimId: player.id,
            victimName: player.name,
            newScore: shooter.score 
          });
          checkWinCondition();
        }
        break;
      }
    }
  }

  projectiles = projectiles.filter((projectile) => projectile.timeLeft > 0);

  io.emit("players", players);
  io.emit("projectiles", projectiles);
};

const main = async () => {
  ({ ground2D, decal2D } = await LoadMap());

  io.on("connect", (socket) => {
    console.log("user connected", socket.id);

    socket.on("joinGame", (playerName) => {
      const sanitizedName = playerName.trim().substring(0, 20) || "Player";

      inputsMap[socket.id] = {
        up: false,
        down: false,
        left: false,
        right: false,
      };

      players.push({
        id: socket.id,
        name: sanitizedName,
        voiceId: Math.floor(Math.random() * 1000000),
        x: 400,
        y: 400,
        score: 0,
        isMuted: false,
      });

      socket.emit("map", {
        ground: ground2D,
        decal: decal2D,
      });

      socket.emit("gameState", gameState);
      io.emit("players", players);

      console.log(`${sanitizedName} joined the game`);
    });

    socket.on("inputs", (inputs) => {
      inputsMap[socket.id] = inputs;
    });

    socket.on("mute", (isMuted) => {
      const player = players.find((player) => player.id === socket.id);
      if (player) {
        player.isMuted = isMuted;
      }
    });

    socket.on("voiceId", (voiceId) => {
      const player = players.find((player) => player.id === socket.id);
      if (player) {
        player.voiceId = voiceId;
      }
    });

    socket.on("projectiles", (angle) => {
      if (gameState !== "playing") return;

      const player = players.find((player) => player.id === socket.id);
      if (!player) return;

      projectiles.push({
        angle,
        x: player.x + PLAYER_SIZE / 2,
        y: player.y + PLAYER_SIZE / 2,
        timeLeft: 1000,
        playerId: socket.id,
      });
    });

    socket.on("disconnect", () => {
      players = players.filter((player) => player.id !== socket.id);
      delete inputsMap[socket.id];
      console.log("user disconnected", socket.id);
    });
  });

  app.use(express.static("public"));
  const PORT = process.env.PORT;
  httpServer.listen(PORT);

  let lastUpdate = Date.now();
  setInterval(() => {
    const now = Date.now();
    const delta = now - lastUpdate;
    tick(delta);
    lastUpdate = now;
  }, 1000 / TICK_RATE);

};

main();