var fs = require('fs-extra');
var path = require('path');
var pd = require('pretty-data').pd;
var dom = require('xmldom').DOMParser;
var xpath = require('xpath');
var setXMLProperties = require(__dirname + path.sep + "request-valuer.js", "utf8");


/**
  Traitement de vérification de trames
  */
var checker = function doStepCheck(runningTestStep, format) {
	var dir = runningTestStep.dir;
	var runDir = runningTestStep.runDir;
	var teststep = runningTestStep.teststep;
	var properties = runningTestStep.properties;
	var debug = runningTestStep.debug;

  runningTestStep.console.log("* " + teststep.stepID  + " - " + teststep.stepName);
  
  if (teststep.stepOptions.xmlID == null || 
    teststep.stepOptions.asserts == null
    ) {
    runningTestStep.console.error("Error parsing " + teststep.stepID + " options.\n xmlID, asserts are mandatory.\nPlease correct your json testcase before relaunch nora.js.");
    runningTestStep.console.dir(teststep);
    throw new Error("Malformated sendRequest test step");
  }

  var xmlPath = runDir + path.sep + teststep.stepOptions.xmlID + "." + format;

  if (!fs.existsSync(xmlPath)) {
      runningTestStep.console.error("  * Cannot find XML %j", xmlPath);
      return "Failed";
  }

  var xmlFile = fs.readFileSync(xmlPath, "utf8");
  var result = true;

  teststep.stepOptions.asserts.forEach(function(myAssert){

    if (myAssert.type == null) {
      runningTestStep.console.error("Error parsing assertion.\n type is mandatory.\nPlease correct your json testcase before relaunch nora.js.");
      runningTestStep.console.dir(myAssert);
      throw new Error("Malformated assertion test step");
    }

    switch(myAssert.type) {
      case "contains" :
        if (myAssert.value == null) {
          runningTestStep.console.error("Error parsing assertion.\n value is mandatory.\nPlease correct your json testcase before relaunch nora.js.");
          runningTestStep.console.dir(myAssert);
          throw new Error("Malformated assertion test step");
        }

        var tmpResult = (xmlFile.indexOf(setXMLProperties(runningTestStep, myAssert.value, myAssert.namespaces, properties, debug)) > -1);
        result  = result && tmpResult;
        
        if (!tmpResult) {
          runningTestStep.console.error("  * " + myAssert.type  + " - " + myAssert.value + " : " + tmpResult);
          console.dir(xmlFile);
        }
        else 
          runningTestStep.console.log("  * " + myAssert.type  + " - " + myAssert.value + " : " + tmpResult);

        break;
      case "notContains" :
        if (myAssert.value == null) {
          runningTestStep.console.error("Error parsing assertion.\n value is mandatory.\nPlease correct your json testcase before relaunch nora.js.");
          runningTestStep.console.dir(myAssert);
          throw new Error("Malformated assertion test step");
        }

        var tmpResult = (xmlFile.indexOf(setXMLProperties(runningTestStep, myAssert.value,myAssert.namespaces, properties, debug)) == -1);
        result  = result && tmpResult;

        if (!tmpResult) {
          runningTestStep.console.error("  * " + myAssert.type  + " - " + myAssert.value + " : " + tmpResult);
          console.dir(xmlFile);
        }
        else 
          runningTestStep.console.log("  * " + myAssert.type  + " - " + myAssert.value + " : " + tmpResult);

        break;
      case "xpath" :
        if (myAssert.xpath == null || myAssert.match == null) {
          runningTestStep.console.error("Error parsing assertion.\n xpath and match are mandatory.\nPlease correct your json testcase before relaunch nora.js.");
          runningTestStep.console.dir(myAssert);
          throw new Error("Malformated assertion test step");
        }

        var tmpResult = false;
        try {
          var doc = new dom().parseFromString(xmlFile);
          var select = xpath.useNamespaces(myAssert.namespaces);
          var nodes = select(myAssert.xpath, doc);
          var match = setXMLProperties(runningTestStep, myAssert.match, myAssert.matchNamespaces, properties, debug, runDir);
          if (match ==  nodes[0].firstChild.nodeValue) {
            tmpResult = true;
          } 
        } catch (err) {
          runningTestStep.console.error(err);
          tmpResult = false;
        }
        result  = result && tmpResult;
        
        if (!tmpResult) {
          runningTestStep.console.error("  * " + myAssert.type  + " - " + myAssert.xpath + " : " + tmpResult);
          console.dir(xmlFile);
        }
        else 
          runningTestStep.console.log("  * " + myAssert.type  + " - " + myAssert.xpath + " : " + tmpResult);

        break;
      default:
        runningTestStep.console.error("* Unrecognize assert type %j", myAssert.type);
        return "Failed";
    }
  });
  if (result) 
    return "Passed";
  else
    return "Failed";

}

module.exports = checker;

