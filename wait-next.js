var shelljs = require('shelljs');
var path = require('path');

/**
 Traitement de vérification de trames
 */
var waitNext = function doStepCheckJson(runningTestStep) {
    var dir = runningTestStep.dir;
    var runDir = runningTestStep.runDir;
    var teststep = runningTestStep.teststep;
    var debug = runningTestStep.debug;

    runningTestStep.console.log("* " + teststep.stepID + " - " + teststep.stepName);

    if (teststep.stepOptions.waitBeforeNextStep == null) {
        runningTestStep.console.error("Error parsing " + teststep.stepID + " option.\n waitBeforeNextStep is mandatory.\nPlease correct your json testcase before relaunch nora.js.");
        runningTestStep.console.dir(teststep);
        throw new Error("Malformated waitNext test step");
    }
    runningTestStep.console.log("  * Wait : " + teststep.stepOptions.waitBeforeNextStep + "s");
    var cmd = "python \"" + __dirname + path.sep + "lib" + path.sep +  "sleep.py\" " + teststep.stepOptions.waitBeforeNextStep;
    if (debug) runningTestStep.console.log("  * Command : " +cmd);
    shelljs.exec(cmd);

    return "Passed";
}

module.exports = waitNext;