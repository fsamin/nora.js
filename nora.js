var console = require('better-console');
var fs = require('fs-extra');
var path = require('path');
var program = require('commander');
var moment = require('moment');
var table = require('easy-table');
var shelljs = require('shelljs');
var pd = require('pretty-data').pd;

program
  .version('0.0.1')
  .option('-d, --debug', 'debug mode')
  .option('-t, --testcase [filename]', 'set the testcase', 'tests/getWeatherTest/getWeatherTestCase.json')
  .parse(process.argv);

var dir = path.resolve(path.dirname(program.testcase));
var runDir = path.join(dir, "runs" + path.sep + path.basename(program.testcase, ".json") + path.sep +  moment().format("YYYYMMDD-HHmmss"));
fs.mkdirsSync(runDir);

console.info("# Loading %j", program.testcase);
console.info("# Running in %j", runDir);

var testcase = JSON.parse(fs.readFileSync(program.testcase, 'utf8'));

var properties = [];
var result = [];

var setXMLProperties = require(__dirname + path.sep + "request-valuer.js", "utf8");
var printResult = require(__dirname + path.sep + "status-printer.js", "utf8");
var loader = require(__dirname + path.sep + "loader.js", "utf8");
var requestMaker = require(__dirname + path.sep + "request-generator.js", "utf8");
var requestSender = require(__dirname + path.sep + "request-sender.js", "utf8");
var restSender = require(__dirname + path.sep + "rest-sender.js", "utf8");
var xmlChecker = require(__dirname + path.sep + "payload-checker.js", "utf8");
var jsonChecker = require(__dirname + path.sep + "json-checker.js", "utf8");

testcase.forEach(doTestStep);

var t = new table();

result.forEach(function (res) {
    t.cell('Id', res.id);
    t.cell('Description', res.step);
    t.cell('Result', res.result, printResult);
    t.newRow();
});

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
        status = requestSender(runningTestStep);
        break;
      case "sendRest" :
        status = restSender(runningTestStep);
        break;
      case "checkXML" :
        status = xmlChecker(runningTestStep);
        break;
      case "checkJSON" :
        status = jsonChecker(runningTestStep);
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
  result.push({id : index, step : teststep.stepName, result: status});
}



