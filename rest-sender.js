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

    console.log("* " + teststep.stepID + " - " + teststep.stepName);

    if (teststep.stepOptions.method == null ||
        ((teststep.stepOptions.protocol == null ||
        teststep.stepOptions.host == null ||
        teststep.stepOptions.port == null ||
        teststep.stepOptions.path == null ) &&
        teststep.stepOptions.url == null) ||
        teststep.stepOptions.responseID == null ||
        teststep.stepOptions.responseExtension == null
    ) {
        console.error("Error parsing " + teststep.stepID + " options.\n method, (protocol, host, port, path) or url, responseID, responseExtension are mandatory.\nPlease correct your json testcase before relaunch nora.js.");
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

    var namespaces = teststep.stepOptions.namespaces
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
        'method': teststep.stepOptions.method,
        'headers': setProperties(teststep.stepOptions.headers, namespaces, properties, debug, runDir),
        'params': setProperties(teststep.stepOptions.params, namespaces, properties, debug, runDir),
        'auth': auth,
        'proxies': proxies,
        'timeout': timeout,
        'data': data
    };

    if (teststep.stepOptions.url) {
        req['url'] = setProperties(teststep.stepOptions.url, namespaces, properties, debug, runDir);
        console.log("  * Sending request to " + setProperties(teststep.stepOptions.url, namespaces, properties, debug, runDir));
    } else {
        req['host'] = setProperties(teststep.stepOptions.host, namespaces, properties, debug, runDir);
        req['port'] = setProperties(teststep.stepOptions.port, namespaces, properties, debug, runDir);
        req['path'] = setProperties(teststep.stepOptions.path, namespaces, properties, debug, runDir);
        req['protocol'] = setProperties(teststep.stepOptions.protocol, namespaces, properties, debug, runDir);
        console.log("  * Sending request to " + setProperties(teststep.stepOptions.protocol, namespaces, properties, debug, runDir) + "://" + setProperties(teststep.stepOptions.host, namespaces, properties, debug, runDir) + ":" + setProperties(teststep.stepOptions.port, namespaces, properties, debug, runDir) + setProperties(teststep.stepOptions.path, namespaces, properties, debug, runDir));
    }

    if (proxies) {
        console.log("  * Using proxies : " + JSON.stringify(proxies));
    }
    if (timeout) {
        console.log("  * With timeout : " + timeout + "s");
    }
    try {
        jsonReq = JSON.stringify(req).replace(/\"/g, "'")
        cmd = "python \"" + __dirname + path.sep + "lib" + path.sep + "httpRequests.py\" \"" + jsonReq + "\""
        if (debug) console.log("  * Command : " + cmd)
        retour = shelljs.exec(cmd, {silent: true});
    } catch (err) {
        console.error("  * Error sending http request...");
        console.error(err);
        return "Failed";
    }

    retour = JSON.parse(retour.output);

    fs.writeFileSync(responseFilePath, retour.text, {"encoding": "utf8"});
    console.log("  * HTTP-Status : " + retour.code);

    if (retour.code != 200) {
        console.error("   * Error " + retour.code + " " + retour.text + " send by server.");
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
