const mapImage = new Image();
mapImage.src = "./snowy-sheet.png";

const canvasEle = document.getElementById("canvas");
canvasEle.width = window.innerWidth;
canvasEle.height = window.innerHeight;
const canvas = canvasEle.getContext('2d');

const socket = io("ws://localhost:3000");
let map = [[]];

socket.on("connect", () => {
	console.log("connected")
})

socket.on("map", (loadedMap) => {
	map = loadedMap;
});

const TILES_IN_ROW = 8;
const TILE_SIZE = 16;

const loop = () => {
	canvas.clearRect(0, 0, canvas.width, canvas.height);

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
	
	window.requestAnimationFrame(loop);
}

window.requestAnimationFrame(loop);