const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const LoadMap = require("./map_loader")

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const main = async () => {
  const map2D = await LoadMap();

  io.on("connect", (socket) => {
    console.log("user connected", socket.id);

    socket.emit("map", map2D);
  })

  app.use(express.static("public"));
  httpServer.listen(3000);
}

main()
