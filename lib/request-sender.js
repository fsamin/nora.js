var fs = require('fs-extra');
var path = require('path');
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

    runningTestStep.console.log("* " + teststep.stepID + " - " + teststep.stepName);

    if (teststep.stepOptions.requestID == null ||
        ((teststep.stepOptions.protocol == null ||
                teststep.stepOptions.host == null ||
                teststep.stepOptions.port == null ||
                teststep.stepOptions.path == null ) &&
            teststep.stepOptions.url == null) ||
        teststep.stepOptions.SOAPAction == null ||
        teststep.stepOptions.responseID == null
    ) {
        runningTestStep.console.error("Error parsing " + teststep.stepID + " options.\n requestID, protocol, host, port, path and SOAPAction and responseID are mandatory.\nPlease correct your json testcase before relaunch nora.js.");
        runningTestStep.console.dir(teststep);
        throw new Error("Malformated sendRequest test step");
    }

    var namespaces = teststep.stepOptions.namespaces
    var requestFilePath = runDir + path.sep + teststep.stepOptions.requestID + ".xml";
    var responseFilePath = runDir + path.sep + teststep.stepOptions.responseID + ".xml";

    if (!fs.existsSync(requestFilePath)) {
        runningTestStep.console.error("  * Cannot find XML %j", requestFilePath);
        return "Failed";
    }

    var requestFile = fs.readFileSync(requestFilePath, "utf8");
    var getHeaders = function(stepOptions, requestFile) {
        var soapAction = setXMLProperties(runningTestStep, teststep.stepOptions.SOAPAction, namespaces, properties, debug, runDir);
        var contentType = 'text/xml;';
        return {
            'SOAPAction': soapAction,
            'Content-Type': contentType,
            'Accept-Encoding': 'gzip,deflate',
            'Content-Length': requestFile.length,
            'User-Agent': "Nora.js"
        }
    };

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
        'method': "POST",
        'headers': getHeaders(teststep.stepOptions, requestFile),
        'auth': auth,
        'proxies': proxies,
        'timeout': timeout
    };

    if (teststep.stepOptions.url) {
        req['url'] = setXMLProperties(runningTestStep, teststep.stepOptions.url, namespaces, properties, debug, runDir);
        runningTestStep.console.log("  * Sending request to " + setXMLProperties(runningTestStep, teststep.stepOptions.url, namespaces, properties, debug, runDir));
    } else {
        req['host'] = setXMLProperties(runningTestStep, teststep.stepOptions.host, namespaces, properties, debug, runDir);
        req['port'] = setXMLProperties(runningTestStep, teststep.stepOptions.port, namespaces, properties, debug, runDir);
        req['path'] = setXMLProperties(runningTestStep, teststep.stepOptions.path, namespaces, properties, debug, runDir);
        req['protocol'] = setXMLProperties(runningTestStep, teststep.stepOptions.protocol, namespaces, properties, debug, runDir);
        runningTestStep.console.log("  * Sending request to " + setXMLProperties(runningTestStep, teststep.stepOptions.protocol, namespaces, properties, debug, runDir) + "://" + setXMLProperties(runningTestStep, teststep.stepOptions.host, namespaces, properties, debug, runDir) + ":" + setXMLProperties(runningTestStep, teststep.stepOptions.port, namespaces, properties, debug, runDir) + setXMLProperties(runningTestStep, teststep.stepOptions.path, namespaces, properties, debug, runDir));
    }

    if (proxies) {
        runningTestStep.console.log("  * Using proxies : " + JSON.stringify(proxies));
    }
    if (timeout) {
        runningTestStep.console.log("  * With timeout : " + timeout + "s");
    }
    try {
		jsonReq = JSON.stringify(req).replace(/\"/g,"'") 
		cmd = "python \"" + __dirname + path.sep + "httpRequests.py\" \"" + jsonReq + "\" \"" + requestFilePath + "\" \"" + responseFilePath + "\""
		if (debug) runningTestStep.console.log ("  * Command : " +cmd)
        retour = shelljs.exec(cmd, {silent: true});
    } catch (err) {
        runningTestStep.console.error("  * Error sending http request...");
        runningTestStep.console.error(err);
        return "Failed";
    }

    retour = JSON.parse(retour.output);
    runningTestStep.console.log("  * HTTP-Status : " + retour.code);

    if (retour.code != 200) {
        runningTestStep.console.error("   * Error " + retour.code + " " + retour.text + " send by server.");
        return "Failed";
    }

    var responseFile = fs.readFileSync(responseFilePath, "utf8");
    responseFile = pd.xml(responseFile);
    fs.writeFileSync(responseFilePath, responseFile, {
        "encoding": "utf8"
    });

    return "Passed";
}


module.exports = sender;