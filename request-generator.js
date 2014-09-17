var fs = require('fs-extra');
var path = require('path');
var console = require('better-console');
var setXMLProperties = require(__dirname + path.sep + "valuer.js", "utf8");
var pd = require('pretty-data').pd;


/**
  Traitement de préparation de requête
  */
var gen = function doStepMakeRequest(dir,runDir,teststep, properties, debug) {
  console.log("* " + teststep.stepID  + " - " + teststep.stepName);
  
  if (teststep.stepOptions.requestID == null || 
    teststep.stepOptions.requestTemplate == null 
    ) {
    console.error("Error parsing " + teststep.stepID + " options.\n requestID, requestTemplate are mandatory.\nPlease correct your json testcase before relaunch nora.js.");
    console.dir(teststep);
    throw new Error("Malformated makeRequest test step");
  }

  var template = dir + path.sep + teststep.stepOptions.requestTemplate;
  console.log("  * Loading Request Template " + template);
  try {
    var request = fs.readFileSync(template, "utf8");
    request = setXMLProperties(request, teststep.stepOptions.namespaces, properties, debug, runDir);
    console.log("  * Saving Request " + teststep.stepOptions.requestID + ".xml");
    fs.writeFileSync(runDir  + path.sep + teststep.stepOptions.requestID+".xml", pd.xml(request), "utf8", function(err) {
        if(err) {
            console.error(err);
            throw err;
        } 
    }); 
  } catch (err) {
    console.error("  * Error while parsing %j", template);
    throw err;
  }
  return "Passed";
}


module.exports = gen;
