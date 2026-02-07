const mapImage = new Image();
const santaImage = new Image();

mapImage.src = "./snowy-sheet.png";
santaImage.src = "./santa.png";

const canvasEle = document.getElementById("canvas");
canvasEle.width = window.innerWidth;
canvasEle.height = window.innerHeight;

const canvas = canvasEle.getContext('2d');
const socket = io("ws://localhost:3000");

const TILES_IN_ROW = 8;
const TILE_SIZE = 16;

let map = [[]];
let players = [];

socket.on("connect", () => {
	console.log("connected")
})

socket.on("map", (loadedMap) => {
	map = loadedMap;
});

socket.on("players", (serverPlayers) => {
	players = serverPlayers;
});

const inputs = {
	up: false,
	down: false,
	right: false,
	left: false
};

window.addEventListener("keydown", (e) => {
	if (e.key === 'a' || e.key === "ArrowLeft")
		inputs["left"] = true;
	else if (e.key === 's' || e.key === "ArrowDown")
		inputs["down"] = true;
	else if (e.key === 'w' || e.key === "ArrowUp")
		inputs["up"] = true;
	else if (e.key === 'd' || e.key === "ArrowRight")
		inputs["right"] = true;

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

	socket.emit("inputs", inputs);
});

const loop = () => {
	canvas.clearRect(0, 0, canvasEle.width, canvasEle.height);

	for (let r = 0; r < map.length; r++) {
		for (let c = 0; c < map[0].length; c++) {
			const { id } = map[r][c];
			const imageRow = parseInt(id / TILES_IN_ROW);
			const imageCol = id % TILES_IN_ROW;

			canvas.drawImage(
				mapImage,
				imageCol * TILE_SIZE,
				imageRow * TILE_SIZE,
				TILE_SIZE,
				TILE_SIZE,
				c * TILE_SIZE,
				r * TILE_SIZE,
				TILE_SIZE,
				TILE_SIZE
			);
		}
	}

	for (const player of players){
		canvas.drawImage(santaImage, player.x, player.y);
	}

	window.requestAnimationFrame(loop);
}

window.requestAnimationFrame(loop);