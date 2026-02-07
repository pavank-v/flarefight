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
let snowballs = [];

socket.on("connect", () => {
	console.log("connected")
})

socket.on("map", (loadedMap) => {
	map = loadedMap;
});

socket.on("players", (serverPlayers) => {
	players = serverPlayers;
});

socket.on("snowballs", (serverSnowballs) => {
	snowballs = serverSnowballs;
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

window.addEventListener("click", (e) => {
	const angle = Math.atan2(
		e.clientY - canvasEle.height / 2,
		e.clientX - canvasEle.width / 2
	);

	socket.emit("snowballs", angle);
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
				c * TILE_SIZE - cameraX,
				r * TILE_SIZE - cameraY,
				TILE_SIZE,
				TILE_SIZE
			);
		}
	}

	for (const player of players) {
		canvas.drawImage(santaImage, player.x - cameraX, player.y - cameraY);
	}

	for (const snowball of snowballs) {
		canvas.fillStyle = "#000000";
		canvas.beginPath();
		canvas.arc(
			snowball.x - cameraX,
			snowball.y - cameraY,
			3,
			0,
			2 * Math.PI
		);
		canvas.fill();
	}

	window.requestAnimationFrame(loop);
}

window.requestAnimationFrame(loop);