const fs = require("fs");
const jimp = require("jimp");
const path = require("path");
const fetch = require("node-fetch");
const jsdom = require("jsdom").JSDOM;

function fetchData(url) {
    return fetch(url, {
        method : "GET",
        headers : {
            "User-Agent" : "MagicMirror/MMM-Liquipedia-Dota2/1.0; (https://github.com/buxxi/MMM-Liquipedia-Dota2)"
        }
    }).then(response => {
        if (response.status != 200) {
            throw new Error(response.status + ": " + response.statusText);
        }
        return response.json();
    }).catch(err => {
        throw err;
    });
}

function fetchImages(data) {
    let fetching = [];
    for (team of data) {
        let filename = path.resolve(__dirname, "public", "logos", team.filename);
        if (!fs.existsSync(filename)) {
            fetching.push(fetchImage(team.url, filename));
        }
    }
    return Promise.all(fetching);
}

function fetchImage(url, filename) {
    return new Promise(async (resolve, reject) => {
        let res = await fetch(url);
        let fileStream = fs.createWriteStream(filename);
        res.body.pipe(fileStream);

        res.body.on("error", (err) => {
            reject(err);
        });
        fileStream.on("finish", function() {
            resolve(filename);
        });
    });
}

function parseTeams(data, baseImageUrl) {
    let dom = new jsdom(data.parse.text['*']);
    let spans = dom.window.document.querySelectorAll(".team-template-image-icon");
    let result = [];

    for (span of spans) {
        let team = { "url" : baseImageUrl + span.querySelector("img").src, "filename" : logoFileName(span.querySelector("a").title) };
        if (team.url && team.filename) {
            result.push(team);
        }
    }

    return new Promise((resolve, reject) => {
        resolve(result);
    });
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

function cropImage(image, filename) {
    return new Promise((resolve, reject) => {
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

        resolve(image.crop(left, top, width, height));
    });
}

function invertIfNeeded(image, filename) {
    return new Promise((resolve, reject) => {
        if (isOnlyTooDarkColors(image)) {
            console.log("Inverting colors for " + filename);
            image = image.invert();
        }
        resolve(image);
    });
}

function modifyImage(filename) {
    return new Promise((resolve, reject) => {
        jimp.read(filename)
        .then(image => cropImage(image, filename))
        .then(image => invertIfNeeded(image, filename))
        .then(image => {
            image.write(filename);
            resolve(filename);
        });    
    });
}

function modifyImages(filenames) {
    let modifications = filenames.map(filename => modifyImage(filename));
    return Promise.all(modifications);
}

fetchData("https://liquipedia.net/dota2/api.php?action=parse&format=json&page=Portal:Teams")
    .then(data => parseTeams(data, "https://liquipedia.net"))
    .then(data => fetchImages(data))
    .then(data => modifyImages(data));