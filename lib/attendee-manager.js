var axios = require('axios');

exports.signupAttendee = function(attendee) {
	return axios({
        url: 'https://developer.loopd.com/api/v1/onsite/attendees?access_key=12345',
        method: 'post',
        headers: {
            'Content-Type': 'application/json'
        },
        data: {
            "eventId": parseInt(attendee.eventId),
            "email": attendee.email,
            "provider": attendee.provider,
            "providerAttendeeId": attendee.providerAttendeeId,
            "firstname": attendee.firstname,
            "lastname": attendee.lastname,
            "organization": attendee.organization,
            "title": attendee.title
        }
    });
}

exports.checkinAttendee = function(attendee) {
    return axios({
        url: 'https://developer.loopd.com/api/v1/onsite/attendees/checkin?access_key=12345',
        headers: {
            'Content-Type': 'application/json'
        },
        data: {
            "eventId": attendee.eventId,
            "kioskId": attendee.checkInWorker,
            "isCheckIn": true,
            "providerAttendeeId": attendee.providerAttendeeId
        }
    });
}