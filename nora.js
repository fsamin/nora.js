var console = require('better-console');
var request = require('request');
var httpsync;
try {
  httpsync = require('http-sync');
} catch (ex) {
  httpsync = require('http-sync-win');
}
var fs = require('fs-extra');
var path = require('path');
var program = require('commander');
var moment = require('moment');
var table = require('easy-table');
var shelljs = require('shelljs');
var pd = require('pretty-data').pd;
var dom = require('xmldom').DOMParser;
var xpath = require('xpath');

program
  .version('0.0.1')
  .option('-d, --debug', 'debug mode')
  .option('-t, --testcase [filename]', 'set the testcase', 'tests/getWeatherTest/getWeatherTestCase.json')
  .option('-r, --report [filename]','set the file report','reports/report.xml')
  .parse(process.argv);

var dir = path.resolve(path.dirname(program.testcase));
var dirReport = path.resolve(path.dirname(program.report));

var runDir = path.join(dir, "runs" + path.sep + path.basename(program.testcase, ".json") + path.sep +  moment().format("YYYYMMDD-HHmmss"));
fs.mkdirsSync(runDir);
fs.mkdirSync(dirReport);

console.info("# Loading %j", program.testcase);
console.info("# Running in %j", runDir);

var testcase = JSON.parse(fs.readFileSync(program.testcase, 'utf8'));

var properties = [];
var result = [];

var setXMLProperties = require(__dirname + path.sep + "valuer.js", "utf8");
var loader = require(__dirname + path.sep + "loader.js", "utf8");
var requestMaker = require(__dirname + path.sep + "request-generator.js", "utf8");
var reportMaker = require(__dirname + path.sep + "report-generator.js", "utf8");

testcase.forEach(doTestStep);

var t = new table();

var nbKo=0;
result.forEach(function (res) {
    t.cell('Id', res.id);
    t.cell('Description', res.step.stepName);
    t.cell('Result', res.result, printResult);
    t.newRow();
	if(res.result != 'Passed'){
		nbKo++;
	} 
});
reportMaker(result,program.testcase,nbKo,program.report);
console.info("# TestCase %j Report", program.testcase);
console.log(t.toString());

/**
  Traitement principal itératif sur le flux JSON du cas de test
  */
function doTestStep(teststep, index, testcase) {

  var runningTestStep = {
    index : index,
    debug : program.debug,
    dir : dir,
    runDir : runDir,
    teststep : teststep,
    properties : properties,
    status : "No Run",
    stdout : null,
  }; 

  
  var status;
  var nbAttempt = 1;
  var retry = true;
  while (status != "passed" && retry) {
    switch(teststep.stepAction) {
      case "loadProperties" :
        status = loader(runningTestStep);
        if (program.debug) console.dir(properties);
        break;
      case "makeRequest" :
        status = requestMaker(runningTestStep);
        break;
      case "sendRequest" :
        status = doStepSendRequest(teststep);
        break;
      case "checkXML" :
        status = doStepCheckXML(teststep);
        break;
      default:
        console.error("* Unrecognize stepAction %j", teststep.stepAction);
        console.dir(teststep);
        status = "Failed";
    }
    runningTestStep.status = status;
    if (status != "Passed" && teststep.stepReplayOnFailure) {
      nbAttempt++;
      if (nbAttempt <= teststep.stepReplayOnFailure) {
        console.warn(" * Last step is failed. Retry");
        if (teststep.stepWaitBeforeReplay) {
          shelljs.exec("python " + __dirname + path.sep + "lib" + path.sep +  "sleep.py " + teststep.stepWaitBeforeReplay);
        }
        retry = true;
      } else {
        retry = false;
      }
    } else {
      retry = false;
    }
  }

  result.push({id : index, step : teststep ,result: status});
}

/**
  Traitement d'envoi de la requête synchrone et de sauvegarde de la réponse
  */
function doStepSendRequest(teststep) {
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
    var soapAction = setXMLProperties(teststep.stepOptions.SOAPAction, null, properties, program.debug, runDir);
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
    host: setXMLProperties(teststep.stepOptions.host, null, properties, program.debug),
    port: setXMLProperties(teststep.stepOptions.port, null, properties, program.debug),
    path: setXMLProperties(teststep.stepOptions.path, null, properties, program.debug),
    protocol: setXMLProperties(teststep.stepOptions.protocol, null, properties, program.debug),
    method: "POST",
    useragent: "Nora.js",
    headers: getHeaders(teststep.stepOptions, requestFile)
  });
  console.log("  * Sending request to " + setXMLProperties(teststep.stepOptions.protocol, null, properties, program.debug) + "://" + setXMLProperties(teststep.stepOptions.host, null, properties, program.debug) + ":" + setXMLProperties(teststep.stepOptions.port, null, properties, program.debug) + setXMLProperties(teststep.stepOptions.path, null, properties, program.debug));
  req.write(requestFile);
  try {
    if (program.debug) console.dir(req);
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

/**
  Traitement de vérification de trames
  */
function doStepCheckXML(teststep) {
  console.log("* " + teststep.stepID  + " - " + teststep.stepName);
  
  if (teststep.stepOptions.xmlID == null || 
    teststep.stepOptions.asserts == null
    ) {
    console.error("Error parsing " + teststep.stepID + " options.\n xmlID, asserts are mandatory.\nPlease correct your json testcase before relaunch nora.js.");
    console.dir(teststep);
    throw new Error("Malformated sendRequest test step");
  }

  var xmlPath = runDir + path.sep + teststep.stepOptions.xmlID + ".xml";

  if (!fs.existsSync(xmlPath)) {
      console.error("  * Cannot find XML %j", xmlPath);
      return "Failed";
  }

  var xmlFile = fs.readFileSync(xmlPath, "utf8");
  var result = true;

  teststep.stepOptions.asserts.forEach(function(myAssert){

    if (myAssert.type == null) {
      console.error("Error parsing assertion.\n type is mandatory.\nPlease correct your json testcase before relaunch nora.js.");
      console.dir(myAssert);
      throw new Error("Malformated assertion test step");
    }

    switch(myAssert.type) {
      case "contains" :
        if (myAssert.value == null) {
          console.error("Error parsing assertion.\n value is mandatory.\nPlease correct your json testcase before relaunch nora.js.");
          console.dir(myAssert);
          throw new Error("Malformated assertion test step");
        }

        var tmpResult = (xmlFile.indexOf(setXMLProperties(myAssert.value, myAssert.namespaces, properties, program.debug)) > -1);
        result  = result && tmpResult;
        console.log("  * " + myAssert.type  + " - " + myAssert.value + " : " + tmpResult);
        break;
      case "notContains" :
        if (myAssert.value == null) {
          console.error("Error parsing assertion.\n value is mandatory.\nPlease correct your json testcase before relaunch nora.js.");
          console.dir(myAssert);
          throw new Error("Malformated assertion test step");
        }

        var tmpResult = (xmlFile.indexOf(setXMLProperties(myAssert.value,myAssert.namespaces, properties, program.debug)) == -1);
        result  = result && tmpResult;
        console.log("  * " + myAssert.type  + " - " + myAssert.value + " : " + tmpResult);
        break;
      case "xpath" :
        if (myAssert.xpath == null || myAssert.match == null) {
          console.error("Error parsing assertion.\n xpath and match are mandatory.\nPlease correct your json testcase before relaunch nora.js.");
          console.dir(myAssert);
          throw new Error("Malformated assertion test step");
        }

        var tmpResult = false;
        try {
          var doc = new dom().parseFromString(xmlFile);
          var select = xpath.useNamespaces(myAssert.namespaces);
          var nodes = select(myAssert.xpath, doc);
          var match = setXMLProperties(myAssert.match, myAssert.matchNamespaces, properties, program.debug, runDir);
          if (match ==  nodes[0].firstChild.nodeValue) {
            tmpResult = true;
          } 
        } catch (err) {
          console.error(err);
          tmpResult = false;
        }
        result  = result && tmpResult;
        console.log("  * " + myAssert.type  + " - " + myAssert.match + " : " + tmpResult);
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

function printResult (val, width) {
   if ( val == "Failed") {
      return '\033[31m' + String(val) + '\033[39m';
    } else if (val == "Passed") {
      return '\033[32m' + String(val) + '\033[39m';
    } else {
      return table.string(val);
    }
}
