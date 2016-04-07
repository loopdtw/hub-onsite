var express = require('express');
var router = express.Router();

router.get('/', function(req, res) {
  res.render('index');
});

router.post('/start-scan', function(req, res) {
  var currentAttendee = req.body;
  // noble.startScanning(serviceUUIDs, true);
  console.log(req.body);
  res.send("OK");
});

router.post('/stop-scan', function(req, res) {
  noble.stopScanning();
});

module.exports = router;

//unused code
function syncBadge(attendeeId, badge, callback) {
  attendeeData = [{
    eventAttendeeId: attendeeId,
    badge: badge,
    syncTime: Date.now()
  }];

  request.post({
    headers: {
      'content-type': 'application/json',
      'Authorization': 'k6BxzvaXhGXWTviwUOUqzPIEc3WeG5DwUXKiUyT4JJKN2hDZy1tCFEjT8MpGoYeb'
    },
    url: 'https://internal-api.loopd.com/api/v1/Events/59/eventattendees/badges',
    json: {
      eventAttendees: attendeeData,
      source: "WEB_E",
      sourceId: "WE:WE:WE:WE"
    },
  }, function(error, response, body) {
    logger.info(body);
    callback(error, body);
  });
}