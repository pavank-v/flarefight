const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const LoadMap = require("./map_loader")

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const TICK_RATE = 30;
const SPEED = 5;
let players = [];
let inputsMap = {};

const tick = () => {
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

  io.emit("players", players);
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

    socket.on("disconnect", () => {
      players = players.filter((player) => {
        player.id != socket.id;
      })
    })

  });

  console.log("players: ", players)
  app.use(express.static("public"));
  httpServer.listen(3000);

  setInterval(tick, 1000 / TICK_RATE);
}

main()
