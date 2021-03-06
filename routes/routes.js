var router = require('express').Router();
var htmlPath = "./frontend/html/"
var syncManager = require('../lib/sync-manager');
var attendeeManager = require('../lib/attendee-manager');
var logger = require('loopd-logger').logger;

router.get('/', function(req, res) {
    syncManager.setLookup(false);
    res.sendFile('onsite/onsite.html', {
        "root": htmlPath
    });
});

router.get('/lookup', function(req, res) {
    syncManager.setLookup(true);
    res.sendFile('lookup/lookup.html', {
        "root": htmlPath
    });
});

router.get('/search', function(req, res) {
    syncManager.setLookup(false);
    res.sendFile('search/search.html', {
        "root": htmlPath
    });
});

router.get('/signup', function(req, res) {
    syncManager.setLookup(false);
    res.sendFile('signup/signup.html', {
        "root": htmlPath
    });
});

router.post('/signup', function(req, res) {
    var attendee = req.body.attendee;
    return attendeeManager.signupAttendee(attendee).then(function(data) {
        return attendeeManager.checkinAttendee(attendee);
    }).then(function(data){
        res.sendStatus(200);
    }).catch(function(err) {
        console.log(err);
    });
});

router.post('/command-badge', function(req, res) {
    var badge = req.body.badge;
    var badgeCommand = new Buffer(req.body.badgeCommand, 'hex');
    
    syncManager.commandBadge(badge, badgeCommand).then(function() {
        res.sendStatus(200);
    }).catch(function(err) {
        logger.error(err);
        res.status(err.httpCode).send({
            error: err.message
        });
    });
});

router.post('/sync-badge', function(req, res) {
    syncManager.syncNextAvailableBadge(req.body.attendee);
    res.sendStatus(200);
});

router.post('/update-existing-badges', function(req, res) {
    var existingBadges = req.body.existingBadges;
    if(!existingBadges) return res.status(400).send('Existing badges required.');
    syncManager.updateExistingBadges(existingBadges);
    res.sendStatus(200);
});

router.post('/unsync-badge', function(req, res) {
    var badge = req.body.badge;
    return syncManager.unsyncBadgeAsync(badge).then(function() {
        res.sendStatus(200);
    });
});

module.exports = router;
