var express = require('express');
var router = express.Router();
var htmlPath = "../frontend/html/"

router.get('/status', function(req, res) {
    res.send(200);
});

router.get('/', function(req, res) {
    res.sendFile('onsite/onsite.html', {
        "root": htmlPath
    });
});

router.get('/lookup', function(req, res) {
    res.sendFile('lookup/lookup.html', {
        "root": htmlPath
    });
});

router.get('/search', function(req, res) {
    res.sendFile('search/search.html', {
        "root": htmlPath
    });
});

router.get('/signup', function(req, res) {
    res.sendFile('signup/signup.html', {
        "root": htmlPath
    });
});

module.exports = router;
