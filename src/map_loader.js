const tmx = require("tmx-parser");

const loadMap = async () => {
    const map = await new Promise((resolve, reject) => {
        tmx.parseFile("src/map.tmx", (err, loadedMap) => {
            if (err) return reject(err);
            resolve(loadedMap);
        });
    });
    
    const layer = map.layers[0];
    const groundTiles = layer.tiles;
    const decalTiles = map.layers[1].tiles;
    const ground2D = [];
    const decal2D = [];
    
    for (let r = 0; r < map.height; r++) {
        const groundRow = [];
        const decalRow = [];

        for (let c = 0; c < map.width; c++) {
            const groundTile = groundTiles[r * map.width + c];
            groundRow.push({ id: groundTile.id, gid: groundTile.gid });
            const decalTile = decalTiles[r * map.width + c];

            if (decalTile) {
                decalRow.push({
                    id: decalTile.id,
                    gid: decalTile.gid
                });
            } else {
                decalRow.push(undefined);
            }
        }

        ground2D.push(groundRow);
        decal2D.push(decalRow);
    }

    return {ground2D, decal2D}
}

module.exports = loadMap;