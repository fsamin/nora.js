var fs = require('fs-extra');
var path = require('path');
var console = require('better-console');
var pd = require('pretty-data').pd;
var setProperties = require(__dirname + path.sep + "request-valuer.js", "utf8");
var shelljs = require('shelljs');

/**
  Traitement d'envoi de la requête synchrone et de sauvegarde de la réponse
  */
var restSender = function doStepRestRequest(runningTestStep) {
	var dir = runningTestStep.dir;
	var runDir = runningTestStep.runDir;
	var teststep = runningTestStep.teststep;
	var properties = runningTestStep.properties;
	var debug = runningTestStep.debug;

  	console.log("* " + teststep.stepID  + " - " + teststep.stepName);

  if (teststep.stepOptions.method == null ||
    ((teststep.stepOptions.protocol == null ||
                teststep.stepOptions.host == null ||
                teststep.stepOptions.port == null ||
                teststep.stepOptions.path == null ) &&
            teststep.stepOptions.url == null) ||
    teststep.stepOptions.responseID == null ||
    teststep.stepOptions.responseExtension == null
    ) {
    console.error("Error parsing " + teststep.stepID + " options.\n method, protocol, host, port, path  and responseID, responseExtension are mandatory.\nPlease correct your json testcase before relaunch nora.js.");
    console.dir(teststep);
    throw new Error("Malformated sendRequest test step");
  }

  if (teststep.stepOptions.requestID && teststep.stepOptions.requestExtension) {
    var requestFilePath = runDir + path.sep + teststep.stepOptions.requestID + teststep.stepOptions.requestExtension;
    if (!fs.existsSync(requestFilePath)) {
          console.error("  * Cannot find input file %j", requestFilePath);
          return "Failed";
    }
    var data = fs.readFileSync(requestFilePath, "utf8");
  }
  var responseFilePath = runDir + path.sep + teststep.stepOptions.responseID + teststep.stepOptions.responseExtension;



  if (teststep.stepOptions.http_user && teststep.stepOptions.http_pwd) {
    var auth = [teststep.stepOptions.http_user, teststep.stepOptions.http_pwd];
  }

  if (teststep.stepOptions.proxies) {
    var proxies = teststep.stepOptions.proxies;
  }

  if (teststep.stepOptions.timeout) {
      var timeout = teststep.stepOptions.timeout;
  }

  var req = {
    'method' : teststep.stepOptions.method,
    'headers' : setProperties(teststep.stepOptions.headers, null, properties, debug),
    'params' : setProperties(teststep.stepOptions.params, null, properties, debug),
    'auth' : auth,
    'proxies' : proxies,
    'timeout' : timeout,
    'data' : data
  };

  if (teststep.stepOptions.url) {
    req['url'] = setProperties(teststep.stepOptions.url, null, properties, debug);
      console.log("  * Sending request to " + setProperties(teststep.stepOptions.url, null, properties, debug));
  } else {
    req['host'] = setProperties(teststep.stepOptions.host, null, properties, debug);
    req['port'] = setProperties(teststep.stepOptions.port, null, properties, debug);
    req['path'] = setProperties(teststep.stepOptions.path, null, properties, debug);
    req['protocol'] = setProperties(teststep.stepOptions.protocol, null, properties, debug);
      console.log("  * Sending request to " + setProperties(teststep.stepOptions.protocol, null, properties, debug) + "://" + setProperties(teststep.stepOptions.host, null, properties, debug) + ":" + setProperties(teststep.stepOptions.port, null, properties, debug) + setProperties(teststep.stepOptions.path, null, properties, debug));
  }

  if (proxies) {
    console.log("  * Using proxies : " + JSON.stringify(proxies));
  }
  if (timeout) {
    console.log("  * With timeout : " + timeout +"s");
  }
  try {
    if (debug) console.dir(req);
    retour = shelljs.exec("python " + __dirname + path.sep + "lib" + path.sep +  "httpRequests.py '" + JSON.stringify(req) +"'", {silent:true});
  } catch (err) {
    console.error("  * Error sending http request...");
    console.error(err);
    return "Failed";
  }

  fs.writeFileSync(responseFilePath, retour.output, {"encoding": "utf8"});


  if (retour.code != 0) {
    console.error("   * Error " + retour + " send by server.");
    console.error("   * See more details in " + responseFilePath + ".");	
    return "Failed";
  }

  var responseFile = fs.readFileSync(responseFilePath, "utf8");
  if (teststep.stepOptions.responseExtension == ".xml") {
    responseFile = pd.xml(responseFile);
  }
  if (teststep.stepOptions.responseExtension == ".json") {
    responseFile = pd.json(responseFile);
  }

  fs.writeFileSync(responseFilePath, responseFile, {"encoding": "utf8"});

  return "Passed";
}


module.exports = restSender;
