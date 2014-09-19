var fs = require('fs-extra');
var path = require('path');
var console = require('better-console');
var pd = require('pretty-data').pd;
var setXMLProperties = require(__dirname + path.sep + "request-valuer.js", "utf8");
var shelljs = require('shelljs');

/**
  Traitement d'envoi de la requête synchrone et de sauvegarde de la réponse
  */
var sender = function doStepSendRequest(runningTestStep) {
	var dir = runningTestStep.dir;
	var runDir = runningTestStep.runDir;
	var teststep = runningTestStep.teststep;
	var properties = runningTestStep.properties;
	var debug = runningTestStep.debug;

  	console.log("* " + teststep.stepID  + " - " + teststep.stepName);

  if (teststep.stepOptions.requestID == null || 
    teststep.stepOptions.protocol == null ||
    teststep.stepOptions.host == null ||
    teststep.stepOptions.port == null ||
    teststep.stepOptions.path == null ||
    teststep.stepOptions.SOAPAction == null ||
    teststep.stepOptions.responseID == null
    ) {
    console.error("Error parsing " + teststep.stepID + " options.\n requestID, protocol, host, port, path and SOAPAction and responseID are mandatory.\nPlease correct your json testcase before relaunch nora.js.");
    console.dir(teststep);
    throw new Error("Malformated sendRequest test step");
  }

  var requestFilePath = runDir + path.sep + teststep.stepOptions.requestID + ".xml";
  var responseFilePath = runDir + path.sep + teststep.stepOptions.responseID + ".xml";

  if (!fs.existsSync(requestFilePath)) {
      console.error("  * Cannot find XML %j", requestFilePath);
      return "Failed";
  }

  var requestFile = fs.readFileSync(requestFilePath, "utf8");
  var getHeaders = function(stepOptions, requestFile) {
    var soapAction = setXMLProperties(teststep.stepOptions.SOAPAction, null, properties, debug, runDir);
    var contentType = 'text/xml; charset="utf-8"';
    return {
        'SOAPAction': soapAction,
        'Content-Type' : contentType,
        'Accept-Encoding' : 'gzip,deflate',
        'Content-Length' : requestFile.length,
        'User-Agent' : "Nora.js"
    }
  };

  if (teststep.stepOptions.http_user && teststep.stepOptions.http_pwd) {
    var auth = [teststep.stepOptions.http_user, teststep.stepOptions.http_pwd];
  }

  if (teststep.stepOptions.proxies) {
    var proxies = teststep.stepOptions.proxies;
  }

  var req = {
    'host' : setXMLProperties(teststep.stepOptions.host, null, properties, debug),
    'port' : setXMLProperties(teststep.stepOptions.port, null, properties, debug),
    'path' : setXMLProperties(teststep.stepOptions.path, null, properties, debug),
    'protocol' : setXMLProperties(teststep.stepOptions.protocol, null, properties, debug),
    'method' : "POST",
    'headers' : getHeaders(teststep.stepOptions, requestFile),
    'auth' : auth,
    'proxies' : proxies
  };

  console.log("  * Sending request to " + setXMLProperties(teststep.stepOptions.protocol, null, properties, debug) + "://" + setXMLProperties(teststep.stepOptions.host, null, properties, debug) + ":" + setXMLProperties(teststep.stepOptions.port, null, properties, debug) + setXMLProperties(teststep.stepOptions.path, null, properties, debug));
  try {
    if (debug) console.dir(req);
    retour = shelljs.exec("python " + __dirname + path.sep + "lib" + path.sep +  "httpRequests.py '" + JSON.stringify(req) + "' \"" + requestFilePath + "\" \"" + responseFilePath + "\"", {silent:true});
  } catch (err) {
    console.error("  * Error sending http request...");
    console.error(err);
    return "Failed";
  }
  console.log("  * HTTP-Status:" + retour.output);

  if (retour.output != 200) {
    console.error("   * Error " + retour + " send by server. See detail below.");
    return "Failed";
  }

  return "Passed";
}


module.exports = sender;
