const fs = require("fs/promises");
const jimp = require("jimp");
const path = require("path");
const fetch = require("node-fetch");
const jsdom = require("jsdom").JSDOM;

const USER_AGENT = "MagicMirror/MMM-Liquipedia-Matches/1.0; (https://github.com/buxxi/MMM-Liquipedia-Matches)";
const IMAGE_BASE_URL = "https://liquipedia.net";
const TEAMS_URL = "https://liquipedia.net/${game}/api.php?action=parse&format=json&page=Portal:Teams"

async function fetchTeams(game) {
    let url = TEAMS_URL.replace("${game}", game);
    let response = await fetch(url, {
        method : "GET",
        headers : {
            "User-Agent" : USER_AGENT
        }
    });

    if (response.status != 200) {
        throw new Error(response.status + ": " + response.statusText);
    }
    
    return await response.json();
}

async function fetchImages(data, game) {
    let filenames = [];
    let dirname = path.resolve(__dirname, "public", "logos", game);

    await fs.mkdir(dirname, { recursive : true });

    for (team of data) {
        let filename = path.resolve(dirname, team.filename);
        try {
            await fs.access(filename);
        } catch (e) {
            filenames.push(await fetchImage(team.url, filename));
        }
    }
    return filenames;
}

function fetchImage(url, filename) {
    return new Promise(async (resolve, reject) => {
        console.log("Downloading " + url);
        let res = await fetch(url);
        let fileStream = (await fs.open(filename, 'w')).createWriteStream();
        res.body.pipe(fileStream);

        res.body.on("error", (err) => {
            reject(err);
        });
        fileStream.on("finish", function() {
            resolve(filename);
        });
    });
}

async function parseTeams(data) {
    let dom = new jsdom(data.parse.text['*']);
    let spans = dom.window.document.querySelectorAll(".team-template-image-icon");
    let result = [];

    for (span of spans) {
        let team = { "url" : IMAGE_BASE_URL + span.querySelector("img").src, "filename" : logoFileName(span.querySelector("a").title) };
        if (team.url && team.filename) {
            result.push(team);
        }
    }

    return result;
}

function logoFileName(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, "") + ".png";
}

function isFullyTransparentRow(image, y) {
    for (var x = 0; x < image.getWidth(); x++) {
        if (image.getPixelColor(x, y) & 0xFF > 0) {
            return false;
        }    
    }   
    return true;
}

function isFullyTransparentColumn(image, x) {
    for (var y = 0; y < image.getHeight(); y++) {
        if (image.getPixelColor(x, y) & 0xFF > 0) {
            return false;
        }    
    }   
    return true;
}

function isOnlyTooDarkColors(image) {
    for (var x = 0; x < image.getWidth(); x++) {
        for (var y = 0; y < image.getHeight(); y++) {
            let color = jimp.intToRGBA(image.getPixelColor(x, y));
            if (color.a > 0 && ((color.r + color.g + color.b) / 3) > 64) {
                return false;
            }
        }
    }
    return true;
}

async function cropImage(image, filename) {
    var left = 0;
    var right = 0;
    var top = 0;
    var bottom = 0;
    while (isFullyTransparentColumn(image, left)) {
        left++;
    }
    while (isFullyTransparentColumn(image, image.getWidth() - 1 - right)) {
        right++;
    }
    while (isFullyTransparentRow(image, top)) {
        top++;
    }
    while (isFullyTransparentColumn(image, image.getHeight() - 1 - bottom)) {
        bottom++;
    }

    let width = image.getWidth() - left - right;
    let height = image.getHeight() - top - bottom;

    console.log("Cropping " + filename + " to (" + left + ", " + right + ", " + top + ", " + bottom + ")");

    return await image.crop(left, top, width, height);
}

async function invertIfNeeded(image, filename) {
    if (isOnlyTooDarkColors(image)) {
        console.log("Inverting colors for " + filename);
        image = await image.invert();
    }
    return image;
}

async function modifyImage(filename) {
    var image = await jimp.read(filename);
    image = await cropImage(image, filename);
    image = await invertIfNeeded(image, filename);
    await image.write(filename);
}

async function modifyImages(filenames) {
    for (filename of filenames) {
        modifyImage(filename);
    }
}

let game = process.argv[2];
fetchTeams(game)
    .then(data => parseTeams(data))
    .then(data => fetchImages(data, game))
    .then(data => modifyImages(data));