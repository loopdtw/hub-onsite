var exec = require('child_process').exec;
var execAsync = Promise.promisify(exec);
var logger = require('../logger').getLogger();
var git = require('git-rev');

/**
 * Configuration parameters
 */
var TRACKING_BRANCH = 'feature/cluster';
var FETCHING_REMOTE_IN_MSECOND = 30 * 1000; // default fetch every 30 seconds
var trackingRemoteTimer = null;
var fetchRemoteCmd = 'git fetch origin ' + TRACKING_BRANCH;

git.short(function (str) {
    SOFTWARE_VERSION = str
});

git.branch(function (str) {
    GIT_BRANCH = str
});

exports.upgrade = function () {
    logger.info('Checking current software...');
    return Promise.try(function() {
        if (trackingRemoteTimer) return;
        return _fetchRemoteSoftware();
    }).then(function() {
        return _isLatestSoftwareAsync();
    }).then(function(isLatestSoftware) {
        if (isLatestSoftware) return logger.info('Running on latest software!');
        return _pullLatestSoftware();
    }).catch(function(err) {
        logger.error('Something wrong during software upgrade procedure!\n', err);
    });
};

function _fetchRemoteSoftware() {
    logger.info('Try to fetch remote software status!');
    return execAsync(fetchRemoteCmd).then(function () {
        _fetchSoftwareInPeriod();
    });
}

function _fetchSoftwareInPeriod() {
    trackingRemoteTimer = setTimeout(function () {
        return _fetchRemoteSoftware().catch(function (err) {
            logger.warn('Fail to checking remote software!');
        });
    }, FETCHING_REMOTE_IN_MSECOND);
}

function _pullLatestSoftware() {
    logger.warn('Trying to checkout and upgrade latest software');
    var checkoutCmd = 'git checkout ' + TRACKING_BRANCH;
    var mergeCmd = 'git merge origin/' + TRACKING_BRANCH;
    return execAsync(checkoutCmd + ';' + mergeCmd).then(function () {
        logger.warn('Upgrade to latest software done, ready to reboot ');
        // check running device is "edison" or not
        if (process.env.NODE_MACHINE !== 'edison') {
            return logger.warn('Run on development device, no need to reboot!');
        }
        return execAsync('reboot');
    }).catch(function (err) {
        logger.warn('Fail to pull and upgrade latest hub software', err);
    });
}

function _isLatestSoftwareAsync() {
    return Promise.join(
        execAsync('git rev-parse --short HEAD'),
        execAsync('git rev-parse --abbrev-ref HEAD'),
        execAsync('git rev-parse --short remotes/origin/' + TRACKING_BRANCH),
        function (localCode, localBranch, remoteCode) {
            localCode = localCode.slice(0, localCode.length - 1);
            localBranch = localBranch.slice(0, localBranch.length - 1);
            remoteCode = remoteCode.slice(0, remoteCode.length - 1);
            if (localBranch !== TRACKING_BRANCH) {
                logger.warn('Hub software not run on %s branch!', TRACKING_BRANCH);
                return false;
            }
            if (localCode !== remoteCode) {
                logger.warn('Hub software not run on latest %s code!', TRACKING_BRANCH);
                return false;
            }
            return true;
        }).catch(function (err) {
            logger.warn('Fail to check current software version', err);
            return true;
        });
}
