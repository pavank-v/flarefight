const tmx = require("tmx-parser");

const loadMap = async () => {
    const map = await new Promise((resolve, reject) => {
        tmx.parseFile("src/map.tmx", (err, loadedMap) => {
            if (err) return reject(err);
            resolve(loadedMap);
        });
    });
    
    const layer = map.layers[0];
    const tiles = layer.tiles;
    const map2D = new Array(map.height).fill('').map(() => new Array(map.width));
    
    for (let r = 0; r < map.height; r++) {
        for (let c = 0; c < map.width; c++) {
            const tile = tiles[r * map.width + c];
            map2D[r][c] = { id: tile.id, gid: tile.gid };
        }

    }

    return map2D;
}

module.exports = loadMap;