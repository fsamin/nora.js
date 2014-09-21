var fs = require('fs-extra');
var path = require('path');
var console = require('better-console');
var jPath = require('JSONPath');
var underscore = require("underscore")

var setProperties = require(__dirname + path.sep + "request-valuer.js", "utf8");

/**
  Traitement de vérification de trames
  */
var checker = function doStepCheckJson(runningTestStep) {
    var dir = runningTestStep.dir;
    var runDir = runningTestStep.runDir;
    var teststep = runningTestStep.teststep;
    var properties = runningTestStep.properties;
    var debug = runningTestStep.debug;

    console.log("* " + teststep.stepID + " - " + teststep.stepName);

    if (teststep.stepOptions.jsonID == null ||
        teststep.stepOptions.asserts == null
    ) {
        console.error("Error parsing " + teststep.stepID + " options.\n jsonID, asserts are mandatory.\nPlease correct your json testcase before relaunch nora.js.");
        console.dir(teststep);
        throw new Error("Malformated sendRequest test step");
    }

    var jsonPath = runDir + path.sep + teststep.stepOptions.jsonID + ".json";

    if (!fs.existsSync(jsonPath)) {
        console.error("  * Cannot find Json %j", jsonPath);
        return "Failed";
    }

    var jsonFile = fs.readFileSync(jsonPath, "utf8");
    var result = true;

    teststep.stepOptions.asserts.forEach(function(myAssert) {

        if (myAssert.type == null) {
            console.error("Error parsing assertion.\n type is mandatory.\nPlease correct your json testcase before relaunch nora.js.");
            console.dir(myAssert);
            throw new Error("Malformated assertion test step");
        }

        switch (myAssert.type) {
            case "contains":
                if (myAssert.value == null) {
                    console.error("Error parsing assertion.\n value is mandatory.\nPlease correct your json testcase before relaunch nora.js.");
                    console.dir(myAssert);
                    throw new Error("Malformated assertion test step");
                }

                var tmpResult = (jsonFile.indexOf(setProperties(myAssert.value, null, properties, debug)) > -1);
                result = result && tmpResult;
                console.log("  * " + myAssert.type + " - " + myAssert.value + " : " + tmpResult);
                break;
            case "notContains":
                if (myAssert.value == null) {
                    console.error("Error parsing assertion.\n value is mandatory.\nPlease correct your json testcase before relaunch nora.js.");
                    console.dir(myAssert);
                    throw new Error("Malformated assertion test step");
                }

                var tmpResult = (jsonFile.indexOf(setProperties(myAssert.value, null, properties, debug)) == -1);
                result = result && tmpResult;
                console.log("  * " + myAssert.type + " - " + myAssert.value + " : " + tmpResult);
                break;
            case "jsonPath":
                if (myAssert.jsonPath == null || myAssert.match == null) {
                    console.error("Error parsing assertion.\n json and match are mandatory.\nPlease correct your json testcase before relaunch nora.js.");
                    console.dir(myAssert);
                    throw new Error("Malformated assertion test step");
                }
                var tmpResult = false;
                try {
                    var jsonObject = JSON.parse(jsonFile);
                    var selected = jPath.eval(jsonObject,myAssert.jsonPath);
                    var match = setProperties(myAssert.match, null, properties, debug, runDir);
                    if (match == selected || underscore.isEqual(match,selected)) {
                        tmpResult = true;
                    }
                } catch (err) {
                    console.error(err);
                    tmpResult = false;
                }
                result = result && tmpResult;
                console.log("  * " + myAssert.type + " - " + JSON.stringify(myAssert.jsonPath) + " = " + JSON.stringify(match) + " : " + tmpResult);
                break;
            default:
                console.error("* Unrecognize assert type %j", myAssert.type);
                return "Failed";
        }
    });
    if (result)
        return "Passed";
    else
        return "Failed";

}

module.exports = checker;