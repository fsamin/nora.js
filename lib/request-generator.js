var fs = require('fs-extra');
var path = require('path');
var setXMLProperties = require(__dirname + path.sep + "request-valuer.js", "utf8");
var pd = require('pretty-data').pd;


/**
  Traitement de préparation de requête
  */
var gen = function doStepMakeRequest(runningTestStep) {
	var dir = runningTestStep.dir;
	var runDir = runningTestStep.runDir;
	var teststep = runningTestStep.teststep;
	var properties = runningTestStep.properties;
	var debug = runningTestStep.debug;

  	runningTestStep.console.log("* " + teststep.stepID  + " - " + teststep.stepName);
  
	if (teststep.stepOptions.requestID == null || 
		teststep.stepOptions.requestTemplate == null 
	) {
		runningTestStep.console.error("Error parsing " + teststep.stepID + " options.\n requestID, requestTemplate are mandatory.\nPlease correct your json testcase before relaunch nora.js.");
		runningTestStep.console.dir(teststep);
		throw new Error("Malformated makeRequest test step");
	}

	var template = dir + path.sep + teststep.stepOptions.requestTemplate;
	runningTestStep.console.log("  * Loading Request Template " + template);
	
	try {
		var request = fs.readFileSync(template, "utf8");
		request = setXMLProperties(runningTestStep, request, teststep.stepOptions.namespaces, properties, debug, runDir);
		runningTestStep.console.log("  * Saving Request " + teststep.stepOptions.requestID + ".xml");
		fs.writeFileSync(runDir  + path.sep + teststep.stepOptions.requestID+".xml", pd.xml(request), "utf8", function(err) {
	    	if(err) {
	        	runningTestStep.console.error(err);
	        	throw err;
	    	} 
		}); 
	} catch (err) {
		runningTestStep.console.error("  * Error while parsing " + template);
		throw err;
	}
	return "Passed";
}


module.exports = gen;
