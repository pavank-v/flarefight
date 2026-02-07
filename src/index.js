const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const LoadMap = require("./map_loader")

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const TICK_RATE = 30;
const SPEED = 5;
const SNOWBALL_SPEED = 7;

let players = [];
let snowballs = [];
let inputsMap = {};

const tick = (delta) => {
  for (const player of players) {
    const input = inputsMap[player.id];
    console.log(player, input)

    if (input.up)
      player.y -= SPEED;
    else if(input.down)
      player.y += SPEED;

    if(input.right)
      player.x += SPEED;
    else if(input.left)
      player.x -= SPEED;
  }

  for (const snowball of snowballs) {
    snowball.x += Math.cos(snowball.angle) * SNOWBALL_SPEED;
    snowball.y += Math.sin(snowball.angle) * SNOWBALL_SPEED;
    snowball.timeLeft -= delta;

    for (const player of players) {
      if (player.id === snowball.playerId) continue;

      const distance = Math.sqrt(
        (player.x + 8 - snowball.x) ** 2 + (player.y + 8 - snowball.y) ** 2
      );

      if (distance <= 8) {
        player.x = 0;
        player.y = 0; 
        snowball.timeLeft = 0;
        break;
      }
    }
  }

  snowballs = snowballs.filter((snowball) => snowball.timeLeft > 0);

  io.emit("players", players);
  io.emit("snowballs", snowballs)
}

const main = async () => {
  const map2D = await LoadMap();

  io.on("connect", (socket) => {
    console.log("user connected", socket.id);

    inputsMap[socket.id] = {
      up: false,
      down: false,
      left: false,
      right: false,
    };

    players.push({
      id: socket.id,
      x: 0,
      y: 0,
    });

    socket.emit("map", map2D);

    socket.on("inputs", (inputs) => {
      inputsMap[socket.id] = inputs;
    });
    
    socket.on("snowballs", (angle) => {
      const player = players.find((player) => player.id === socket.id);

      snowballs.push({
        angle,
        x: player.x,
        y: player.y,
        timeLeft: 1000,
        playerId: socket.id,
      });
    });

    socket.on("disconnect", () => {
      players = players.filter((player) => {
        player.id != socket.id;
      })
    })

  });

  console.log("players: ", players)
  app.use(express.static("public"));
  httpServer.listen(3000);

  let lastUpdate = Date.now();
  setInterval(() => {
    const now = Date.now();
    const delta = now - lastUpdate;
    tick(delta);
    lastUpdate = now;
  }, 1000 / TICK_RATE);
}

main()
