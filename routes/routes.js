var express = require('express');
var router = express.Router();
var htmlPath = "./frontend/html/"

app.get('/status', function(req, res) {
    res.send(200);
});

app.get('/', function(req, res) {
    res.sendFile('onsite/onsite.html', {
        "root": htmlPath
    });
});

app.get('/lookup', function(req, res) {
    res.sendFile('lookup/lookup.html', {
        "root": htmlPath
    });
});

app.get('/search', function(req, res) {
    res.sendFile('search/search.html', {
        "root": htmlPath
    });
});

app.get('/signup', function(req, res) {
    res.sendFile('signup/signup.html', {
        "root": htmlPath
    });
});