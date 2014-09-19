var fs = require('fs-extra');
var path = require('path');
var console = require('better-console');
var pd = require('pretty-data').pd;
var setXMLProperties = require(__dirname + path.sep + "request-valuer.js", "utf8");
var httpsync;
try {
  httpsync = require('http-sync');
} catch (ex) {
  httpsync = require('http-sync-win');
}

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
  
  if (!fs.existsSync(requestFilePath)) {
      console.error("  * Cannot find XML %j", requestFilePath);
      return "Failed";
  }

  var requestFile = fs.readFileSync(requestFilePath, "utf8");

  var getHeaders = function(stepOptions, requestFile) {
    var soapAction = setXMLProperties(teststep.stepOptions.SOAPAction, null, properties, debug, runDir);
    var contentType = 'text/xml; charset="utf-8"';
    if (stepOptions.http_user && stepOptions.http_pwd) {
      var auth = "Basic " + new Buffer(stepOptions.http_user + ":" + stepOptions.http_pwd).toString('base64');
      return {
        'SOAPAction': soapAction,
        'Content-Type' : contentType,
        'Authorization' : auth,
        'Accept-Encoding': 'gzip,deflate',
        'Content-Length': requestFile.length
      };
    } else {
      return {
        'SOAPAction': soapAction,
        'Content-Type' : contentType,
        'Accept-Encoding': 'gzip,deflate',
        'Content-Length': requestFile.length
      };
    }
  };

  var req = httpsync.request({
    host: setXMLProperties(teststep.stepOptions.host, null, properties, debug),
    port: setXMLProperties(teststep.stepOptions.port, null, properties, debug),
    path: setXMLProperties(teststep.stepOptions.path, null, properties, debug),
    protocol: setXMLProperties(teststep.stepOptions.protocol, null, properties, debug),
    method: "POST",
    useragent: "Nora.js",
    headers: getHeaders(teststep.stepOptions, requestFile)
  });
  console.log("  * Sending request to " + setXMLProperties(teststep.stepOptions.protocol, null, properties, debug) + "://" + setXMLProperties(teststep.stepOptions.host, null, properties, debug) + ":" + setXMLProperties(teststep.stepOptions.port, null, properties, debug) + setXMLProperties(teststep.stepOptions.path, null, properties, debug));
  req.write(requestFile);
  try {
    if (debug) console.dir(req);
    response = req.end();
  } catch (err) {
    console.error("  * Error sending http request...");
    console.error(err);
    return "Failed";
  }
  console.log("  * HTTP-Status:" + response.statusCode);
  var responseFile = response.body.toString();

  if (response.statusCode != 200) {
    console.error("   * Error " + response.statusCode + " send by server. See detail below.");
    console.dir(response);
    console.dir(responseFile);
    return "Failed";
  } else {
    var responseFilePath = runDir + path.sep + teststep.stepOptions.responseID + ".xml";
    console.log("  * Saving Response " + teststep.stepOptions.responseID + ".xml");
    fs.writeFileSync(responseFilePath, pd.xml(responseFile), "utf8", function(err) {
        if(err) {
            console.error(err);
            throw err;
        } 
    }); 
  }
  return "Passed";
}

module.exports = sender;
